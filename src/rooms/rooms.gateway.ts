import { ALLOWED_ORIGINS } from "../common/constants/cors.constants";
import {
	ConnectedSocket,
	MessageBody,
	OnGatewayConnection,
	OnGatewayDisconnect,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { JwtService } from "@nestjs/jwt";
import { RoomsService } from "./rooms.service";
import { EntitlementService } from "../entitlement/entitlement.service";
import { PlayerJwtPayload } from "../common/guards/player-jwt.guard";
import {
	PARTY_EVENTS,
	ROOM_EVENTS,
} from "../common/constants/socket-events.constants";
import { PERSISTENCE_EVENTS } from "../common/constants/internal-events.constants";
import { CreateRoomDto } from "./dto/create-room.dto";
import { JoinRoomDto } from "./dto/join-room.dto";

@WebSocketGateway({ cors: { origin: ALLOWED_ORIGINS, credentials: true } })
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
	@WebSocketServer() server!: Server;
	/** socketId -> anonId (identifiant anonyme localStorage cote client), pour les events de connexion/analytics. */
	private readonly anonIdBySocket = new Map<string, string>();

	private readonly tiktokSubmissions = new Map<
		string,
		Map<string, Record<number, string>>
	>();
	private readonly tiktokReviewSessions = new Map<
		string,
		{
			question: string;
			byPlayer: {
				playerId: string;
				pseudo: string;
				placement: Record<number, string>;
			}[];
			baseScores: Record<string, number>;
			penalties: Record<string, number>;
			reviewed: Set<string>;
		}
	>();
	private readonly tiktokFraudVotes = new Map<
		string,
		Map<string, Map<number, Set<string>>>
	>();
	private readonly genericSegmentSubmissions = new Map<
		string,
		Map<string, { points: number; summary: string }>
	>();
	/**
	 * Filet de securite Party Mix : si un joueur reste connecte sans jamais
	 * soumettre (onglet en arriere-plan, client fige...), la manche ne doit
	 * jamais bloquer les autres indefiniment. Arme a chaque debut de segment,
	 * REARME a chaque message socket d'un joueur de la room (voir handleConnection :
	 * les events des autres gateways — croquis, brume, tiktok... — comptent aussi),
	 * desarme des que la manche se termine naturellement. C'est donc une fenetre
	 * d'INACTIVITE, pas un plafond de duree : une Tier List avec tribunal ou un
	 * Croquis de 90s+ ne doivent jamais etre coupes tant que la room est vivante.
	 */
	private readonly segmentWatchdogs = new Map<string, NodeJS.Timeout>();
	private readonly SEGMENT_TIMEOUT_MS = 180_000;
	/**
	 * Room videe (dernier joueur parti) : pas de suppression immediate, un
	 * delai de grace laisse le temps a un reload de page (ou un drop wifi
	 * d'une seconde) de rejoindre le meme code sans perdre la room. Annule des
	 * qu'un JOIN arrive sur ce code (voir handleJoin).
	 */
	private readonly emptyRoomTimers = new Map<string, NodeJS.Timeout>();
	private readonly EMPTY_ROOM_GRACE_MS = 20_000;
	/** Sockets identifies comme bots a la connexion : ignores par les analytics (voir handleConnection/handleDisconnect). */
	private readonly botSockets = new Set<string>();
	/**
	 * User-Agents de bots capables d'executer le JS et donc d'ouvrir un socket :
	 * crawlers en mode rendu (Googlebot...), outils d'audit (Lighthouse), et
	 * fetchers de preview de lien. Tokens volontairement PRECIS pour les
	 * plateformes sociales ("discordbot" et pas "discord") : le navigateur
	 * integre des apps Discord/WhatsApp est un VRAI joueur potentiel, seul
	 * leur robot de preview doit etre filtre. UA vide = pas un navigateur.
	 */
	private static readonly BOT_UA =
		/bot|crawl|spider|slurp|headless|lighthouse|pagespeed|pingdom|uptime|monitor|facebookexternalhit|whatsapp\/|telegrambot|discordbot|twitterbot|preview|python-requests|curl\/|wget\/|axios\/|node-fetch/i;

	constructor(
		private readonly roomsService: RoomsService,
		private readonly eventEmitter: EventEmitter2,
		private readonly jwtService: JwtService,
		private readonly entitlement: EntitlementService,
	) {}

	/**
	 * Statut Supporter au moment du CREATE/JOIN, a partir d'un JWT optionnel
	 * (compte joueur, systeme separe de l'anonId de room). Ne leve JAMAIS
	 * d'exception : un token absent, expire ou force ne doit jamais empecher
	 * de creer/rejoindre une room, il retombe simplement sur `false`.
	 */
	private async resolveIsSubscriber(token?: string): Promise<boolean> {
		if (!token) return false;
		try {
			const payload = await this.jwtService.verifyAsync<PlayerJwtPayload>(token);
			return await this.entitlement.isSubscriber(payload.sub);
		} catch {
			return false;
		}
	}

	handleConnection(client: Socket) {
		const anonId = this.readAnonId(client);
		this.anonIdBySocket.set(client.id, anonId);
		// Bots qui executent le JS (Googlebot en rendu, Lighthouse, previews de
		// liens...) : connexion socket acceptee (aucun impact gameplay) mais pas
		// d'evenement analytics, sinon chaque crawl gonfle les visiteurs uniques.
		if (this.isBotClient(client)) {
			this.botSockets.add(client.id);
		} else {
			this.eventEmitter.emit(PERSISTENCE_EVENTS.SOCKET_CONNECTED, {
				anonId,
				socketId: client.id,
				source: this.readSource(client),
			});
		}
		// Tout message entrant (quel que soit le gateway : croquis:guess,
		// brume:vote, tiktok:fraud-vote...) prouve que la manche du Party Mix
		// n'est pas figee : on repousse le watchdog d'inactivite du segment.
		client.onAny(() => this.touchSegmentWatchdog(client.id));
	}

	handleDisconnect(client: Socket) {
		const roomBefore = this.roomsService.getRoomBySocket(client.id);
		const anonId = this.anonIdBySocket.get(client.id) ?? this.readAnonId(client);
		// Symetrique du filtre de handleConnection : pas de CONNECT enregistre,
		// donc pas de DISCONNECT non plus (sinon la duree de session moyenne se
		// calculerait sur des paires depareillees).
		if (!this.botSockets.delete(client.id)) {
			this.eventEmitter.emit(PERSISTENCE_EVENTS.SOCKET_DISCONNECTED, {
				anonId,
				socketId: client.id,
				roomCode: roomBefore?.code,
				// Approximation deliberee : toute deconnexion pendant une manche compte
				// comme un abandon de CE mini-jeu, qu'il ait deja soumis ou non (le detail
				// "avait deja valide" varie trop d'un mini-jeu a l'autre pour etre suivi
				// generiquement ici) - suffisant pour comparer les mini-jeux entre eux.
				gameId: roomBefore?.status === "in-game" ? roomBefore.currentGameId : null,
			});
		}
		this.anonIdBySocket.delete(client.id);

		const room = this.roomsService.leaveRoom(client.id);
		if (!room) return;
		if (room.players.length > 0) {
			this.server
				.to(room.code)
				.emit(ROOM_EVENTS.PLAYER_LEFT, { playerId: client.id });
			this.server.to(room.code).emit(ROOM_EVENTS.STATE, room);
			// Permet aux mini-jeux (ex: Undercover) de re-verifier une attente
			// bloquee (vote, soumission...) qui ne guettait que ce joueur parti.
			this.eventEmitter.emit("room.player-left", {
				roomCode: room.code,
				playerId: client.id,
			});
		} else {
			// Room videe : delai de grace avant suppression definitive (voir
			// scheduleEmptyRoomCleanup), pour survivre a un reload/drop wifi solo.
			this.scheduleEmptyRoomCleanup(room.code);
		}
	}

	/** Supprime la room pour de bon si personne ne l'a rejointe pendant le delai de grace. */
	private scheduleEmptyRoomCleanup(roomCode: string): void {
		this.clearEmptyRoomTimer(roomCode);
		const timeout = setTimeout(() => {
			this.emptyRoomTimers.delete(roomCode);
			this.roomsService.deleteRoom(roomCode);
			this.eventEmitter.emit(PERSISTENCE_EVENTS.ROOM_CLOSED, { roomCode });
		}, this.EMPTY_ROOM_GRACE_MS);
		this.emptyRoomTimers.set(roomCode, timeout);
	}

	private clearEmptyRoomTimer(roomCode: string): void {
		const existing = this.emptyRoomTimers.get(roomCode);
		if (existing) {
			clearTimeout(existing);
			this.emptyRoomTimers.delete(roomCode);
		}
	}

	/**
	 * Filet de securite anti-fuite memoire : si une room se ferme au milieu d'un
	 * segment (dernier joueur deco pendant une manche Tier list / Party Mix), les
	 * entrees des Maps ci-dessous (indexees par roomCode:...) ne sont jamais
	 * nettoyees par les chemins normaux (fin de segment, timeout watchdog). Sans
	 * ce purge elles restent en memoire indefiniment.
	 */
	@OnEvent(PERSISTENCE_EVENTS.ROOM_CLOSED)
	handleRoomClosedCleanup(payload: { roomCode: string }): void {
		this.purgeRoomState(payload.roomCode);
	}

	private purgeRoomState(roomCode: string): void {
		const prefix = `${roomCode}:`;
		for (const key of Array.from(this.tiktokSubmissions.keys()))
			if (key.startsWith(prefix)) this.tiktokSubmissions.delete(key);
		for (const key of Array.from(this.tiktokReviewSessions.keys()))
			if (key.startsWith(prefix)) this.tiktokReviewSessions.delete(key);
		for (const key of Array.from(this.tiktokFraudVotes.keys()))
			if (key.startsWith(prefix)) this.tiktokFraudVotes.delete(key);
		for (const key of Array.from(this.genericSegmentSubmissions.keys()))
			if (key.startsWith(prefix)) this.genericSegmentSubmissions.delete(key);
		this.clearSegmentWatchdog(roomCode);
	}

	/** Pour les listeners d'analytics (PersistenceListener) qui ont besoin de l'anonId de chaque joueur, pas seulement de son socketId. */
	private playerRefs(room: { players: { id: string }[] }): { id: string; anonId: string }[] {
		return room.players.map((p) => ({
			id: p.id,
			anonId: this.anonIdBySocket.get(p.id) ?? "unknown",
		}));
	}

	/** Vrai si le handshake ressemble a un bot (UA connue ou absente) : voir BOT_UA. */
	private isBotClient(client: Socket): boolean {
		const ua = client.handshake.headers["user-agent"];
		return !ua || RoomsGateway.BOT_UA.test(ua);
	}

	/** Lu depuis le query param envoye par SocketService cote front (io(url, { query: { anonId } })). */
	private readAnonId(client: Socket): string {
		const raw = client.handshake.query.anonId;
		return (Array.isArray(raw) ? raw[0] : raw) || "unknown";
	}

	/** Source d'acquisition calculee cote front (referrer/query param, voir acquisition.ts) : null si non fournie. */
	private readSource(client: Socket): string | null {
		const raw = client.handshake.query.source;
		const value = Array.isArray(raw) ? raw[0] : raw;
		return value ? String(value).slice(0, 40) : null;
	}

	@SubscribeMessage(ROOM_EVENTS.CREATE)
	async handleCreate(
		@ConnectedSocket() client: Socket,
		@MessageBody() dto: CreateRoomDto,
	) {
		try {
			const isSubscriber = await this.resolveIsSubscriber(dto.playerToken);
			const room = this.roomsService.createRoom(
				client.id,
				dto.pseudo?.trim() || "Joueur",
				isSubscriber,
			);
			client.join(room.code);
			client.emit(ROOM_EVENTS.STATE, room);
			this.eventEmitter.emit(PERSISTENCE_EVENTS.ROOM_CREATED, { room });
			this.eventEmitter.emit(PERSISTENCE_EVENTS.ROOM_JOINED, {
				roomCode: room.code,
				anonId: this.anonIdBySocket.get(client.id) ?? this.readAnonId(client),
				isHost: true,
				viaInvite: false,
			});
		} catch (err) {
			client.emit(ROOM_EVENTS.ERROR, { message: (err as Error).message });
		}
	}

	@SubscribeMessage(ROOM_EVENTS.JOIN)
	async handleJoin(
		@ConnectedSocket() client: Socket,
		@MessageBody() dto: JoinRoomDto,
	) {
		try {
			const isSubscriber = await this.resolveIsSubscriber(dto.playerToken);
			const room = this.roomsService.joinRoom(
				client.id,
				dto.code,
				dto.pseudo?.trim() || "Joueur",
				isSubscriber,
			);
			// Quelqu'un vient de (re)rejoindre ce code : plus besoin de la supprimer.
			this.clearEmptyRoomTimer(room.code);
			client.join(room.code);
			const player = room.players.find((p) => p.id === client.id)!;
			client.to(room.code).emit(ROOM_EVENTS.PLAYER_JOINED, player);
			this.server.to(room.code).emit(ROOM_EVENTS.STATE, room);
			this.eventEmitter.emit(PERSISTENCE_EVENTS.ROOM_JOINED, {
				roomCode: room.code,
				anonId: this.anonIdBySocket.get(client.id) ?? this.readAnonId(client),
				isHost: false,
				viaInvite: !!dto.viaInvite,
			});
			if (room.status === "in-game") {
				// Permet a chaque mini-jeu de resynchroniser un joueur qui rejoint
				// une manche deja en cours (voir DraftGateway.handlePlayerJoined).
				this.eventEmitter.emit("room.player-joined", {
					roomCode: room.code,
					playerId: client.id,
				});
			}
		} catch (err) {
			client.emit(ROOM_EVENTS.ERROR, { message: (err as Error).message });
		}
	}

	@SubscribeMessage("room:invite-generated")
	handleInviteGenerated(@ConnectedSocket() client: Socket) {
		const room = this.roomsService.getRoomBySocket(client.id);
		if (!room) return;
		this.eventEmitter.emit(PERSISTENCE_EVENTS.INVITE_GENERATED, {
			roomCode: room.code,
			anonId: this.anonIdBySocket.get(client.id) ?? this.readAnonId(client),
		});
	}

	@SubscribeMessage(ROOM_EVENTS.LEAVE)
	handleLeave(@ConnectedSocket() client: Socket) {
		const room = this.roomsService.getRoomBySocket(client.id);
		if (!room) return;
		client.leave(room.code);
		const updated = this.roomsService.leaveRoom(client.id);
		if (!updated) return;
		this.server
			.to(room.code)
			.emit(ROOM_EVENTS.PLAYER_LEFT, { playerId: client.id });
		if (updated.players.length > 0) {
			this.server.to(room.code).emit(ROOM_EVENTS.STATE, updated);
		} else {
			this.scheduleEmptyRoomCleanup(room.code);
		}
	}

	@SubscribeMessage(ROOM_EVENTS.UPDATE_SETTINGS)
	handleUpdateSettings(
		@ConnectedSocket() client: Socket,
		@MessageBody()
		dto: { roundTimeSec?: number; roundsByGame?: Record<string, number> },
	) {
		try {
			const room = this.roomsService.updateSettings(client.id, dto);
			this.server.to(room.code).emit(ROOM_EVENTS.STATE, room);
		} catch (err) {
			client.emit(ROOM_EVENTS.ERROR, { message: (err as Error).message });
		}
	}

	@SubscribeMessage(ROOM_EVENTS.RENAME)
	handleRename(
		@ConnectedSocket() client: Socket,
		@MessageBody() dto: { pseudo: string },
	) {
		const room = this.roomsService.renamePlayer(
			client.id,
			dto.pseudo?.trim() || "Joueur",
		);
		if (room) this.server.to(room.code).emit(ROOM_EVENTS.STATE, room);
	}

	@SubscribeMessage(ROOM_EVENTS.END_GAME)
	handleEndGame(
		@ConnectedSocket() client: Socket,
		@MessageBody() dto: { summary?: string },
	) {
		try {
			const room = this.roomsService.endGame(client.id, dto.summary);
			const lastRound = room.roundHistory[room.roundHistory.length - 1];
			this.server.to(room.code).emit(ROOM_EVENTS.ROUND_FINISHED, lastRound);
			this.server.to(room.code).emit(ROOM_EVENTS.STATE, room);
		} catch (err) {
			client.emit(ROOM_EVENTS.ERROR, { message: (err as Error).message });
		}
	}

	@SubscribeMessage(ROOM_EVENTS.START_GAME)
	handleStartGame(
		@ConnectedSocket() client: Socket,
		@MessageBody() dto: { gameId: string; forceEvent?: string },
	) {
		try {
			const room = this.roomsService.startGame(client.id, dto.gameId);
			this.server
				.to(room.code)
				.emit(ROOM_EVENTS.GAME_STARTED, { gameId: dto.gameId });
			this.server.to(room.code).emit(ROOM_EVENTS.STATE, room);
			this.eventEmitter.emit("room.game-started", {
				roomCode: room.code,
				gameId: dto.gameId,
				// Best effort, controle dev uniquement (voir room.component.ts) : le
				// service concerne (ex. DraftService) revalide la valeur avant usage.
				forceEvent: dto.forceEvent,
				players: this.playerRefs(room),
			});
		} catch (err) {
			client.emit(ROOM_EVENTS.ERROR, { message: (err as Error).message });
		}
	}

	@SubscribeMessage(ROOM_EVENTS.RESTART_GAME)
	handleRestartGame(
		@ConnectedSocket() client: Socket,
		@MessageBody() dto: { gameId: string },
	) {
		const room = this.roomsService.getRoomBySocket(client.id);
		if (!room) return;
		if (room.hostId !== client.id) {
			client.emit(ROOM_EVENTS.ERROR, {
				message: "Seul l'host peut relancer la partie.",
			});
			return;
		}
		// Le bouton rejouer n'existe que hors Party Mix : clef "solo" uniquement.
		this.genericSegmentSubmissions.delete(`${room.code}:solo:${dto.gameId}`);
		this.server.to(room.code).emit(ROOM_EVENTS.GAME_RESTARTED, { gameId: dto.gameId });
	}

	@SubscribeMessage(PARTY_EVENTS.START)
	handlePartyStart(
		@ConnectedSocket() client: Socket,
		@MessageBody() dto: { playlist: string[] },
	) {
		try {
			const room = this.roomsService.startMix(client.id, dto.playlist);
			this.server.to(room.code).emit(ROOM_EVENTS.STATE, room);
			this.launchCurrentMixSegment(client);
		} catch (err) {
			client.emit(ROOM_EVENTS.ERROR, { message: (err as Error).message });
		}
	}

	@SubscribeMessage(PARTY_EVENTS.NEXT)
	handlePartyNext(@ConnectedSocket() client: Socket) {
		this.launchCurrentMixSegment(client);
	}

	@SubscribeMessage("party:finish")
	handlePartyFinish(@ConnectedSocket() client: Socket) {
		try {
			const room = this.roomsService.finishMix(client.id);
			this.clearSegmentWatchdog(room.code);
			this.server.to(room.code).emit(ROOM_EVENTS.STATE, room);
		} catch (err) {
			client.emit(ROOM_EVENTS.ERROR, { message: (err as Error).message });
		}
	}

	@SubscribeMessage(PARTY_EVENTS.SEGMENT_COMPLETE)
	handleSegmentComplete(
		@ConnectedSocket() client: Socket,
		@MessageBody() dto: { points?: number; summary?: string },
	) {
		const room = this.roomsService.getRoomBySocket(client.id);
		if (!room?.currentGameId) return;
		// Hors Party Mix (jeu lance seul depuis le lobby), room.activeMix est
		// null : on retombe sur un cursor "solo" partage par tous les joueurs
		// de la room, meme convention que tiktokKey().
		if (room.activeMix && room.activeMix.status !== "running") return;
		const cursor = room.activeMix?.cursor ?? "solo";
		const key = `${room.code}:${cursor}:${room.currentGameId}`;
		let submissions = this.genericSegmentSubmissions.get(key);
		if (!submissions) {
			submissions = new Map<string, { points: number; summary: string }>();
			this.genericSegmentSubmissions.set(key, submissions);
		}
		submissions.set(client.id, {
			points: Math.max(0, Math.round(dto.points ?? 0)),
			summary: dto.summary ?? "Manche terminee.",
		});

		const scores = Array.from(submissions.entries()).map(([playerId, entry]) => ({
			playerId,
			pseudo: room.players.find((p) => p.id === playerId)?.pseudo ?? "Joueur",
			points: entry.points,
		}));
		this.server.to(room.code).emit("party:segment-progress", {
			ready: submissions.size,
			total: room.players.length,
			gameId: room.currentGameId,
			scores,
		});

		if (submissions.size >= room.players.length) {
			const scores: Record<string, number> = {};
			const sorted = Array.from(submissions.entries()).sort(
				(a, b) => b[1].points - a[1].points,
			);
			for (const [playerId, entry] of submissions.entries())
				scores[playerId] = entry.points;
			const winnerName =
				room.players.find((p) => p.id === sorted[0]?.[0])?.pseudo ??
				"Un joueur";
			const zero = Array.from(submissions.entries()).find(
				([, entry]) => entry.points <= 0,
			);
			const zeroName = zero
				? room.players.find((p) => p.id === zero[0])?.pseudo
				: null;
			const summary = zeroName
				? `${winnerName} prend la manche. ${zeroName} repart avec 0 point, downfall detecte.`
				: `${winnerName} prend la manche avec ${sorted[0]?.[1].points ?? 0} pts.`;
			const updated = this.roomsService.finishMixSegment(room.code, {
				gameId: room.currentGameId,
				roundNumber: room.roundHistory.length + 1,
				scores,
				summary,
				finishedAt: new Date().toISOString(),
			});
			this.genericSegmentSubmissions.delete(key);
			this.clearSegmentWatchdog(room.code);
			if (updated) this.broadcastRoundFinish(updated.code);
		}
	}

	@SubscribeMessage("tiktok:submit")
	handleTiktokSubmit(
		@ConnectedSocket() client: Socket,
		@MessageBody() dto: { question: string; placement: Record<number, string> },
	) {
		const room = this.roomsService.getRoomBySocket(client.id);
		if (!room) return;
		const key = this.tiktokKey(
			room.code,
			dto.question,
			room.activeMix?.cursor ?? "solo",
		);
		let submissions = this.tiktokSubmissions.get(key);
		if (!submissions) {
			submissions = new Map<string, Record<number, string>>();
			this.tiktokSubmissions.set(key, submissions);
		}
		submissions.set(client.id, dto.placement);

		const ready = submissions.size;
		const total = room.players.length;
		this.server
			.to(room.code)
			.emit("tiktok:progress", { question: dto.question, ready, total });

		if (ready >= total) {
			const byPlayer = Array.from(submissions.entries()).map(
				([playerId, placement]) => ({
					playerId,
					pseudo:
						room.players.find((p) => p.id === playerId)?.pseudo ?? "Joueur",
					placement,
				}),
			);
			const placements = byPlayer.map((r) => r.placement);
			const baseScores: Record<string, number> = {};
			for (const row of byPlayer)
				baseScores[row.playerId] = this.scoreTiktokPlacement(
					row.placement,
					placements,
				);
			this.tiktokReviewSessions.set(key, {
				question: dto.question,
				byPlayer,
				baseScores,
				penalties: {},
				reviewed: new Set<string>(),
			});
			this.tiktokFraudVotes.set(key, new Map());
			this.server.to(room.code).emit("tiktok:results", {
				question: dto.question,
				ready,
				total,
				byPlayer,
			});
			this.tiktokSubmissions.delete(key);
			// Nouvelle fenetre pour la phase tribunal (menee par l'host) : plus lente
			// et distincte de la soumission, elle merite son propre delai plutot que
			// de rester sous le timeout de la phase precedente.
			if (room.activeMix?.status === "running") this.armSegmentWatchdog(room.code);
		}
	}

	@SubscribeMessage("tiktok:fraud-vote")
	handleTiktokFraudVote(
		@ConnectedSocket() client: Socket,
		@MessageBody()
		dto: { question: string; targetPlayerId: string; slot: number },
	) {
		const room = this.roomsService.getRoomBySocket(client.id);
		if (!room || room.players.length < 3 || client.id === dto.targetPlayerId)
			return;

		const key = this.tiktokKey(
			room.code,
			dto.question,
			room.activeMix?.cursor ?? "solo",
		);

		const session = this.tiktokReviewSessions.get(key);
		if (
			!session ||
			!session.byPlayer.some((row) => row.playerId === dto.targetPlayerId)
		)
			return;

		let roomVotes = this.tiktokFraudVotes.get(key);
		if (!roomVotes) {
			roomVotes = new Map<string, Map<number, Set<string>>>();
			this.tiktokFraudVotes.set(key, roomVotes);
		}

		let targetVotes = roomVotes.get(dto.targetPlayerId);
		if (!targetVotes) {
			targetVotes = new Map<number, Set<string>>();
			roomVotes.set(dto.targetPlayerId, targetVotes);
		}

		// 1 SEUL vote par joueur sur la tier list affichée, irréversible
		const alreadyVoted = Array.from(targetVotes.values()).some((voters) =>
			voters.has(client.id),
		);

		if (alreadyVoted) return;

		let slotVotes = targetVotes.get(dto.slot);
		if (!slotVotes) {
			slotVotes = new Set<string>();
			targetVotes.set(dto.slot, slotVotes);
		}

		slotVotes.add(client.id);

		this.server.to(room.code).emit("tiktok:fraud-state", {
			question: dto.question,
			targetPlayerId: dto.targetPlayerId,
			votes: this.serializeFraudVotes(targetVotes),
		});
	}

	@SubscribeMessage("tiktok:review-next")
	handleTiktokReviewNext(
		@ConnectedSocket() client: Socket,
		@MessageBody() dto: { question: string; reviewedPlayerId: string },
	) {
		const room = this.roomsService.getRoomBySocket(client.id);
		if (!room || room.hostId !== client.id) return;
		const key = this.tiktokKey(
			room.code,
			dto.question,
			room.activeMix?.cursor ?? "solo",
		);
		const session = this.tiktokReviewSessions.get(key);
		if (!session || session.reviewed.has(dto.reviewedPlayerId)) return;

		const target = session.byPlayer.find(
			(row) => row.playerId === dto.reviewedPlayerId,
		);
		if (!target) return;

		const tribunal = this.resolveTiktokTribunal(room, session, key, target);
		session.reviewed.add(dto.reviewedPlayerId);
		const nextIndex = session.byPlayer.findIndex(
			(row) => !session.reviewed.has(row.playerId),
		);
		const complete = nextIndex === -1;

		if (
			complete &&
			room.activeMix?.status === "running" &&
			room.currentGameId === "tiktok-ranking"
		) {
			const scores: Record<string, number> = {};
			for (const row of session.byPlayer)
				scores[row.playerId] =
					(session.baseScores[row.playerId] ?? 0) +
					(session.penalties[row.playerId] ?? 0);
			const topOne = this.topChampionForSlot(
				session.byPlayer.map((r) => r.placement),
				1,
			);
			const updated = this.roomsService.finishMixSegment(room.code, {
				gameId: "tiktok-ranking",
				roundNumber: room.roundHistory.length + 1,
				scores,
				summary: `${Math.round((session.byPlayer.filter((r) => r.placement[1] === topOne).length / Math.max(1, session.byPlayer.length)) * 100)}% du lobby met ${topOne} Top 1. Tribunal rendu.`,
				finishedAt: new Date().toISOString(),
				details: this.buildTiktokDetails(dto.question, session.byPlayer),
			});
			this.clearSegmentWatchdog(room.code);
			if (updated)
				setTimeout(() => this.broadcastRoundFinish(updated.code), 2200);
		}

		this.server.to(room.code).emit("tiktok:review-advance", {
			question: dto.question,
			nextIndex: Math.max(0, nextIndex),
			complete,
			tribunal,
		});

		if (complete) {
			this.tiktokReviewSessions.delete(key);
			this.tiktokFraudVotes.delete(key);
		}
	}

	private tiktokKey(
		roomCode: string,
		question: string,
		cursor: number | string,
	): string {
		return `${roomCode}:${question}:${cursor}`;
	}

	private serializeFraudVotes(
		votes: Map<number, Set<string>>,
	): Record<number, string[]> {
		const out: Record<number, string[]> = {};
		for (const [slot, voters] of votes.entries()) out[slot] = [...voters];
		return out;
	}

	/**
	 * Chaque jure vote UNE seule option sur la tier list d'un accuse (-1 = saine,
	 * 0 = entierement frauduleuse, 1-10 = placement precis frauduleux, voir
	 * handleTiktokFraudVote / voteCleanTierList). Le verdict doit toujours suivre
	 * la majorite (l'option la plus votee), jamais un seuil fixe independant par
	 * option : sinon un votre 5 contre 2 sur "entierement frauduleux" pouvait
	 * perdre face a un seuil arbitraire alors que c'est la majorite claire.
	 * En cas d'egalite entre plusieurs options (ou aucun vote), non coupable.
	 */
	private resolveTiktokTribunal(
		room: ReturnType<RoomsService["getRoomBySocket"]> extends infer R
			? NonNullable<R>
			: never,
		session: {
			byPlayer: {
				playerId: string;
				pseudo: string;
				placement: Record<number, string>;
			}[];
			penalties: Record<string, number>;
		},
		key: string,
		target: {
			playerId: string;
			pseudo: string;
			placement: Record<number, string>;
		},
	) {
		const votes =
			this.tiktokFraudVotes.get(key)?.get(target.playerId) ??
			new Map<number, Set<string>>();

		const maxVoters = Math.max(0, room.players.length - 1);
		const penaltyLines: string[] = [];

		const tally = [...votes.entries()]
			.map(([slot, voters]) => ({
				slot,
				voters: [...voters].filter((id) => id !== target.playerId),
			}))
			.filter((entry) => entry.voters.length > 0);

		const maxCount = tally.length ? Math.max(...tally.map((t) => t.voters.length)) : 0;
		const winners = tally.filter((t) => t.voters.length === maxCount);

		if (maxCount === 0 || winners.length !== 1 || winners[0].slot === -1) {
			return {
				title: "Non coupable",
				message:
					winners.length > 1
						? `${target.pseudo} passe entre les mailles du tribunal : le jury est partage, aucune majorite claire.`
						: `${target.pseudo} passe entre les mailles du tribunal.`,
				convicted: [],
				counterFraud: [],
				penaltyLines,
			};
		}

		const winner = winners[0];

		if (winner.slot === 0) {
			session.penalties[target.playerId] =
				(session.penalties[target.playerId] ?? 0) - 10;
			penaltyLines.push(`${target.pseudo} -10 pts`);

			return {
				title: "Droit de parole révoqué",
				message: `${target.pseudo}. Le lobby estime que le dossier entier est frauduleux (${winner.voters.length}/${maxVoters} jurés).`,
				convicted: [],
				counterFraud: [],
				penaltyLines,
				wholeTierFraud: true,
			};
		}

		const champion = target.placement[winner.slot] ?? "ce choix";
		const convicted = [
			{ slot: winner.slot, champion, votes: winner.voters.length, threshold: maxVoters },
		];
		session.penalties[target.playerId] =
			(session.penalties[target.playerId] ?? 0) - 5;
		penaltyLines.push(`${target.pseudo} -5 pts`);

		return {
			title: "Coupable",
			message: `${target.pseudo} a mis ${champion} #${winner.slot}. ${winner.voters.length}/${maxVoters} jurés condamnent ce placement. Le tribunal te juge.`,
			convicted,
			counterFraud: [],
			penaltyLines,
		};
	}

	private launchCurrentMixSegment(client: Socket) {
		try {
			const room = this.roomsService.startNextMixSegment(client.id, (gameId) =>
				this.segmentSizeFor(gameId),
			);
			if (
				!room.currentGameId ||
				!room.activeMix ||
				room.activeMix.status === "finished"
			) {
				this.server.to(room.code).emit(ROOM_EVENTS.STATE, room);
				return;
			}
			const mix = room.activeMix;
			this.server.to(room.code).emit(ROOM_EVENTS.GAME_STARTED, {
				gameId: room.currentGameId,
				mix: {
					active: true,
					roundSize: mix.currentRoundSize,
					mixIndex: mix.cursor,
					mixTotal: mix.total,
				},
			});
			this.server.to(room.code).emit(ROOM_EVENTS.STATE, room);
			this.eventEmitter.emit("room.game-started", {
				roomCode: room.code,
				gameId: room.currentGameId,
				players: this.playerRefs(room),
			});
			this.armSegmentWatchdog(room.code);
		} catch (err) {
			client.emit(ROOM_EVENTS.ERROR, { message: (err as Error).message });
		}
	}

	private armSegmentWatchdog(roomCode: string): void {
		this.clearSegmentWatchdog(roomCode);
		const timeout = setTimeout(
			() => this.forceFinishStuckSegment(roomCode),
			this.SEGMENT_TIMEOUT_MS,
		);
		this.segmentWatchdogs.set(roomCode, timeout);
	}

	private clearSegmentWatchdog(roomCode: string): void {
		const existing = this.segmentWatchdogs.get(roomCode);
		if (existing) {
			clearTimeout(existing);
			this.segmentWatchdogs.delete(roomCode);
		}
	}

	/**
	 * Repousse le watchdog du segment de la room de ce socket, uniquement s'il
	 * est deja arme (= un segment de Party Mix tourne). Appele sur chaque message
	 * socket entrant : fenetre d'inactivite glissante, pas de plafond de duree.
	 */
	private touchSegmentWatchdog(socketId: string): void {
		const room = this.roomsService.getRoomBySocket(socketId);
		if (!room || !this.segmentWatchdogs.has(room.code)) return;
		this.armSegmentWatchdog(room.code);
	}

	/** Debloque une manche Party Mix figee (joueur connecte mais inactif) en la terminant avec ce qui a ete soumis, plutot que de laisser tout le lobby attendre indefiniment. */
	private forceFinishStuckSegment(roomCode: string): void {
		this.segmentWatchdogs.delete(roomCode);
		const room = this.roomsService.getRoom(roomCode);
		if (
			!room ||
			!room.activeMix ||
			room.activeMix.status !== "running" ||
			!room.currentGameId
		)
			return;

		const gameId = room.currentGameId;
		if (gameId === "tiktok-ranking") {
			this.forceFinishStuckTiktokSegment(room.code, room.activeMix.cursor);
			return;
		}

		const key = `${room.code}:${room.activeMix.cursor}:${gameId}`;
		const submissions =
			this.genericSegmentSubmissions.get(key) ??
			new Map<string, { points: number; summary: string }>();
		const scores: Record<string, number> = {};
		for (const player of room.players)
			scores[player.id] = submissions.get(player.id)?.points ?? 0;
		const sorted = Array.from(submissions.entries()).sort(
			(a, b) => b[1].points - a[1].points,
		);
		const winnerName = sorted.length
			? (room.players.find((p) => p.id === sorted[0][0])?.pseudo ?? "Un joueur")
			: null;
		const summary = winnerName
			? `Temps ecoule : ${winnerName} prend la manche, les autres n'ont jamais valide.`
			: "Temps ecoule : personne n'a valide, 0 point pour tout le monde.";
		const updated = this.roomsService.finishMixSegment(room.code, {
			gameId,
			roundNumber: room.roundHistory.length + 1,
			scores,
			summary,
			finishedAt: new Date().toISOString(),
		});
		this.genericSegmentSubmissions.delete(key);
		if (updated) this.broadcastRoundFinish(updated.code);
	}

	/**
	 * Le flux Tier list a son propre cycle (soumission puis tribunal), distinct
	 * du flux generique : on ne connait pas la "question" en cours ici, donc on
	 * balaie les sessions de la room pour ce cursor plutot que de rejouer tout
	 * le scoring. Score neutre (0) pour tout le monde : mieux vaut debloquer le
	 * lobby que figer 15 manches de Party Mix pour un joueur inactif.
	 */
	private forceFinishStuckTiktokSegment(roomCode: string, cursor: number): void {
		const room = this.roomsService.getRoom(roomCode);
		if (
			!room ||
			!room.activeMix ||
			room.activeMix.status !== "running" ||
			room.currentGameId !== "tiktok-ranking"
		)
			return;

		const suffix = `:${cursor}`;
		for (const key of Array.from(this.tiktokSubmissions.keys()))
			if (key.startsWith(`${roomCode}:`) && key.endsWith(suffix))
				this.tiktokSubmissions.delete(key);
		for (const key of Array.from(this.tiktokReviewSessions.keys()))
			if (key.startsWith(`${roomCode}:`) && key.endsWith(suffix))
				this.tiktokReviewSessions.delete(key);
		for (const key of Array.from(this.tiktokFraudVotes.keys()))
			if (key.startsWith(`${roomCode}:`) && key.endsWith(suffix))
				this.tiktokFraudVotes.delete(key);

		const scores: Record<string, number> = {};
		for (const player of room.players) scores[player.id] = 0;
		const updated = this.roomsService.finishMixSegment(room.code, {
			gameId: "tiktok-ranking",
			roundNumber: room.roundHistory.length + 1,
			scores,
			summary: "Temps ecoule : manche Tier list annulee, personne ne marque.",
			finishedAt: new Date().toISOString(),
		});
		if (updated) this.broadcastRoundFinish(updated.code);
	}

	private broadcastRoundFinish(code: string) {
		const updated = this.roomsService.getRoom(code);
		if (!updated) return;
		const lastRound = updated.roundHistory[updated.roundHistory.length - 1];
		this.server.to(code).emit(ROOM_EVENTS.ROUND_FINISHED, lastRound);
		this.server.to(code).emit(ROOM_EVENTS.STATE, updated);
		this.eventEmitter.emit(PERSISTENCE_EVENTS.ROUND_FINISHED, {
			roomCode: code,
			result: lastRound,
			playerCount: updated.players.length,
			players: this.playerRefs(updated),
		});
	}

	private segmentSizeFor(gameId: string): number {
		if (
			gameId === "draft-battle" ||
			gameId === "tiktok-ranking" ||
			gameId === "undercover-champion" ||
			gameId === "brume" ||
			gameId === "loldle" ||
			gameId === "last-survivor"
		)
			return 1;
		return 3;
	}

	private buildTiktokDetails(
		question: string,
		byPlayer: {
			playerId: string;
			pseudo: string;
			placement: Record<number, string>;
		}[],
	) {
		const placements = byPlayer.map((row) => row.placement);
		const lobbyTop = [1, 2, 3].map((slot) => {
			const champion = this.topChampionForSlot(placements, slot);
			return {
				slot,
				champion,
				percent: this.percentForSlot(placements, slot, champion),
			};
		});
		const lobbyBottom = [9, 10].map((slot) => {
			const champion = this.topChampionForSlot(placements, slot);
			return {
				slot,
				champion,
				percent: this.percentForSlot(placements, slot, champion),
			};
		});
		const topOne = lobbyTop[0]?.champion ?? "Yasuo";
		const contrarian = byPlayer.find(
			(row) =>
				Number(
					Object.entries(row.placement).find(
						([, champ]) => champ === topOne,
					)?.[0] ?? 0,
				) >= 8,
		);
		const lonelyBottom =
			this.findLonelyPlacement(byPlayer, 9) ??
			this.findLonelyPlacement(byPlayer, 10);
		const cards = [
			`${lobbyTop[0]?.percent ?? 0}% du lobby met ${topOne} Top 1. Le tribunal a parle.`,
			`Top 3 lobby : ${lobbyTop.map((entry) => entry.champion).join(" / ")}.`,
			`Bottom 2 lobby : ${lobbyBottom.map((entry) => entry.champion).join(" / ")}.`,
			contrarian
				? `${contrarian.pseudo} est le seul a envoyer ${topOne} aussi bas. Mauvais gout détecté.`
				: `Personne n'a vraiment osé trahir ${topOne}. Lobby étonnamment sage.`,
			lonelyBottom
				? `${lonelyBottom.pseudo} est seul a mettre ${lonelyBottom.champion} #${lonelyBottom.slot}. C'est personnel a ce niveau.`
				: `Aucun vote solitaire en bas de classement. Vous etes presque civilises.`,
			`Communaute globale fictive : ${this.fakeCommunityTop(question)} garde la couronne avec 63%.`,
		];
		return {
			type: "tiktok-ranking",
			question,
			lobbyTop,
			lobbyBottom,
			cards,
			byPlayer,
		};
	}

	private percentForSlot(
		placements: Record<number, string>[],
		slot: number,
		champion: string,
	): number {
		if (!placements.length) return 0;
		const count = placements.filter(
			(placement) => placement[slot] === champion,
		).length;
		return Math.round((count / placements.length) * 100);
	}

	private findLonelyPlacement(
		byPlayer: { pseudo: string; placement: Record<number, string> }[],
		slot: number,
	) {
		const counts = new Map<string, number>();
		for (const row of byPlayer) {
			const champion = row.placement[slot];
			if (champion) counts.set(champion, (counts.get(champion) ?? 0) + 1);
		}
		const lonely = byPlayer.find(
			(row) => row.placement[slot] && counts.get(row.placement[slot]) === 1,
		);
		return lonely
			? { pseudo: lonely.pseudo, champion: lonely.placement[slot], slot }
			: null;
	}

	private fakeCommunityTop(question: string): string {
		if (question.toLowerCase().includes("rizz")) return "Sett";
		if (question.toLowerCase().includes("coloc")) return "Singed";
		if (question.toLowerCase().includes("boss")) return "Aatrox";
		if (question.toLowerCase().includes("paf")) return "Wukong";
		return "Yasuo";
	}

	private topChampionForSlot(
		placements: Record<number, string>[],
		slot: number,
	): string {
		const counts = new Map<string, number>();
		for (const placement of placements) {
			const champ = placement[slot];
			if (champ) counts.set(champ, (counts.get(champ) ?? 0) + 1);
		}
		return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Yasuo";
	}

	private scoreTiktokPlacement(
		placement: Record<number, string>,
		allPlacements: Record<number, string>[],
	): number {
		let score = 0;
		for (let slot = 1; slot <= 10; slot++) {
			const consensus = this.topChampionForSlot(allPlacements, slot);
			const ownSlot = Number(
				Object.entries(placement).find(
					([, champ]) => champ === consensus,
				)?.[0] ?? 99,
			);
			score += Math.max(0, 10 - Math.abs(ownSlot - slot) * 2);
		}
		return Math.round(score / 5);
	}
}
