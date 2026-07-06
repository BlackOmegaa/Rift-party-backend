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
			await this.prisma.room.updateMany({
				where: { code, closedAt: null },
				data: { closedAt: new Date() },
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

	async recordGameStarted(
		roomCode: string,
		gameId: string,
		players: { id: string; anonId: string }[],
	): Promise<void> {
		try {
			await this.prisma.sessionEvent.createMany({
				data: players.map((p) => ({
					anonId: p.anonId,
					roomCode,
					gameId,
					type: "GAME_STARTED" as const,
				})),
			});
		} catch (err) {
			this.logger.warn(`recordGameStarted(${roomCode}, ${gameId}) a echoue : ${(err as Error).message}`);
		}
	}

	async recordGameCompleted(
		roomCode: string,
		gameId: string,
		completedPlayerIds: string[],
		players: { id: string; anonId: string }[],
	): Promise<void> {
		try {
			const anonIds = players
				.filter((p) => completedPlayerIds.includes(p.id))
				.map((p) => p.anonId);
			if (!anonIds.length) return;
			await this.prisma.sessionEvent.createMany({
				data: anonIds.map((anonId) => ({
					anonId,
					roomCode,
					gameId,
					type: "GAME_COMPLETED" as const,
				})),
			});
		} catch (err) {
			this.logger.warn(`recordGameCompleted(${roomCode}, ${gameId}) a echoue : ${(err as Error).message}`);
		}
	}

	async recordGameAbandoned(anonId: string, roomCode: string, gameId: string): Promise<void> {
		try {
			await this.prisma.sessionEvent.create({
				data: { anonId, roomCode, gameId, type: "GAME_ABANDONED" },
			});
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
