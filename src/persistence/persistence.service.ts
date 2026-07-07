import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Room, RoundResult } from "../rooms/interfaces/room.interface";

/**
 * Ecrit en BDD aux etapes cles du cycle de vie d'une room, en parallele de
 * l'etat en memoire (RoomsService) qui reste la seule source de verite pour
 * le jeu en direct. Chaque methode avale ses propres erreurs : une panne BDD
 * ne doit jamais faire planter une partie en cours (voir persistence.listener.ts,
 * qui appelle ces methodes depuis des listeners EventEmitter2 fire-and-forget).
 *
 * Simplification V1 : un seul Match par Room (pas un par cycle de Party Mix
 * relance) - suffisant pour les stats de depart, a affiner si besoin plus tard.
 */
@Injectable()
export class PersistenceService {
	private readonly logger = new Logger(PersistenceService.name);
	/** code de room -> id Prisma de la ligne Room, pour eviter de la recreer a chaque round. */
	private readonly roomIdByCode = new Map<string, Promise<string>>();
	/** code de room -> id Prisma du Match courant (cree paresseusement au premier round). */
	private readonly matchIdByCode = new Map<string, Promise<string>>();

	constructor(private readonly prisma: PrismaService) {}

	async recordRoomCreated(room: Room): Promise<void> {
		try {
			const created = this.prisma.room
				.upsert({
					where: { code: room.code },
					create: {
						code: room.code,
						hostPseudoInitial: room.players[0]?.pseudo ?? "Joueur",
						maxPlayersReached: room.players.length,
					},
					update: {},
				})
				.then((row) => row.id);
			this.roomIdByCode.set(room.code, created);
			await created;
		} catch (err) {
			this.logger.warn(`recordRoomCreated(${room.code}) a echoue : ${(err as Error).message}`);
		}
	}

	async recordRoomClosed(code: string): Promise<void> {
		try {
			const now = new Date();
			await this.prisma.room.updateMany({
				where: { code, closedAt: null },
				data: { closedAt: now },
			});
			// Simplification V1 (un seul Match par Room) : la fin de la room cloture
			// aussi son Match courant, ce qui donne une duree de partie exploitable
			// (Match.finishedAt - startedAt) sans devoir suivre chaque relance de
			// Party Mix separement pour l'instant.
			await this.prisma.match.updateMany({
				where: { room: { code }, finishedAt: null },
				data: { finishedAt: now },
			});
		} catch (err) {
			this.logger.warn(`recordRoomClosed(${code}) a echoue : ${(err as Error).message}`);
		} finally {
			this.roomIdByCode.delete(code);
			this.matchIdByCode.delete(code);
		}
	}

	private async getOrCreateRoomId(code: string): Promise<string> {
		const cached = this.roomIdByCode.get(code);
		if (cached) return cached;
		const created = this.prisma.room
			.upsert({
				where: { code },
				create: { code, hostPseudoInitial: "Joueur", maxPlayersReached: 0 },
				update: {},
			})
			.then((row) => row.id);
		this.roomIdByCode.set(code, created);
		return created;
	}

	private async getOrCreateMatchId(code: string, playerCount: number): Promise<string> {
		const cached = this.matchIdByCode.get(code);
		if (cached) return cached;
		const created = (async () => {
			const roomId = await this.getOrCreateRoomId(code);
			const match = await this.prisma.match.create({
				data: { roomId, playlist: [], playerCount },
			});
			return match.id;
		})();
		this.matchIdByCode.set(code, created);
		return created;
	}

	async recordRoundFinished(code: string, result: RoundResult, playerCount: number): Promise<void> {
		try {
			const matchId = await this.getOrCreateMatchId(code, playerCount);
			await this.prisma.round.create({
				data: {
					matchId,
					gameId: result.gameId,
					roundNumber: result.roundNumber,
					scores: result.scores,
					summary: result.summary,
					details: result.details ?? undefined,
					finishedAt: new Date(result.finishedAt),
				},
			});
		} catch (err) {
			this.logger.warn(`recordRoundFinished(${code}) a echoue : ${(err as Error).message}`);
		}
	}

	/** Upsert appele a chaque connexion socket : fige la source d'acquisition a la toute premiere visite (jamais ecrasee ensuite). */
	async upsertVisitor(anonId: string, source: string | null): Promise<void> {
		try {
			const now = new Date();
			await this.prisma.visitor.upsert({
				where: { anonId },
				create: { anonId, firstSeenAt: now, lastSeenAt: now, acquisitionSource: source },
				update: { lastSeenAt: now, visitCount: { increment: 1 } },
			});
		} catch (err) {
			this.logger.warn(`upsertVisitor(${anonId}) a echoue : ${(err as Error).message}`);
		}
	}

	/** Arrivee dans une room : `isHost` pour la creation, `viaInvite` si le code venait d'un lien ?join=. */
	async recordRoomJoin(roomCode: string, anonId: string, isHost: boolean, viaInvite: boolean): Promise<void> {
		try {
			await this.prisma.roomJoin.create({ data: { roomCode, anonId, isHost, viaInvite } });
		} catch (err) {
			this.logger.warn(`recordRoomJoin(${roomCode}) a echoue : ${(err as Error).message}`);
		}
	}

	async recordInviteGenerated(roomCode: string, anonId: string): Promise<void> {
		try {
			await this.prisma.inviteGenerated.create({ data: { roomCode, anonId } });
		} catch (err) {
			this.logger.warn(`recordInviteGenerated(${roomCode}) a echoue : ${(err as Error).message}`);
		}
	}

	/** Un GameSession ouvert par joueur au lancement d'un mini-jeu (segment de Mix ou partie solo). */
	async recordGameStarted(
		roomCode: string,
		gameId: string,
		players: { id: string; anonId: string }[],
	): Promise<void> {
		try {
			await this.prisma.gameSession.createMany({
				data: players.map((p) => ({ anonId: p.anonId, roomCode, gameId })),
			});
		} catch (err) {
			this.logger.warn(`recordGameStarted(${roomCode}, ${gameId}) a echoue : ${(err as Error).message}`);
		}
	}

	/**
	 * Cloture tous les GameSession encore ouverts pour ce (roomCode, gameId) :
	 * COMPLETED pour ceux qui ont un score dans le resultat, ABANDONED pour le
	 * reste (n'ont jamais soumis avant que la manche ne se termine pour la room).
	 * Raw SQL pour calculer `durationSec` directement en base (NOW() - startedAt)
	 * sans avoir a relire chaque ligne pour faire l'arithmetique en JS.
	 */
	async closeGameSessions(
		roomCode: string,
		gameId: string,
		completedAnonIds: string[],
	): Promise<void> {
		try {
			if (completedAnonIds.length) {
				await this.prisma.$executeRaw`
					UPDATE "GameSession"
					SET "endedAt" = NOW(),
					    "outcome" = 'COMPLETED',
					    "durationSec" = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - "startedAt"))::int)
					WHERE "roomCode" = ${roomCode}
					  AND "gameId" = ${gameId}
					  AND "outcome" IS NULL
					  AND "anonId" = ANY(${completedAnonIds})
				`;
			}
			await this.prisma.$executeRaw`
				UPDATE "GameSession"
				SET "endedAt" = NOW(),
				    "outcome" = 'ABANDONED',
				    "durationSec" = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - "startedAt"))::int)
				WHERE "roomCode" = ${roomCode}
				  AND "gameId" = ${gameId}
				  AND "outcome" IS NULL
			`;
		} catch (err) {
			this.logger.warn(`closeGameSessions(${roomCode}, ${gameId}) a echoue : ${(err as Error).message}`);
		}
	}

	/** Deconnexion en pleine manche : cloture seulement la session de CE joueur (les autres continuent). */
	async recordGameAbandoned(anonId: string, roomCode: string, gameId: string): Promise<void> {
		try {
			await this.prisma.$executeRaw`
				UPDATE "GameSession"
				SET "endedAt" = NOW(),
				    "outcome" = 'ABANDONED',
				    "durationSec" = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - "startedAt"))::int)
				WHERE "roomCode" = ${roomCode}
				  AND "gameId" = ${gameId}
				  AND "anonId" = ${anonId}
				  AND "outcome" IS NULL
			`;
		} catch (err) {
			this.logger.warn(`recordGameAbandoned(${roomCode}, ${gameId}) a echoue : ${(err as Error).message}`);
		}
	}

	async recordConnection(anonId: string, socketId: string, roomCode?: string): Promise<void> {
		try {
			await this.prisma.connectionEvent.create({
				data: { anonId, socketId, roomCode, type: "CONNECT" },
			});
		} catch (err) {
			this.logger.warn(`recordConnection(${socketId}) a echoue : ${(err as Error).message}`);
		}
	}

	async recordDisconnection(anonId: string, socketId: string, roomCode?: string): Promise<void> {
		try {
			await this.prisma.connectionEvent.create({
				data: { anonId, socketId, roomCode, type: "DISCONNECT" },
			});
		} catch (err) {
			this.logger.warn(`recordDisconnection(${socketId}) a echoue : ${(err as Error).message}`);
		}
	}
}
