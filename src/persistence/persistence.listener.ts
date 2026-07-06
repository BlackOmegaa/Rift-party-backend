import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { PersistenceService } from "./persistence.service";
import { PERSISTENCE_EVENTS } from "../common/constants/internal-events.constants";
import { Room, RoundResult } from "../rooms/interfaces/room.interface";

/**
 * Ecoute les events internes emis par RoomsGateway et delegue l'ecriture BDD
 * a PersistenceService. Reste separe du gateway pour que celui-ci n'ait jamais
 * a connaitre Prisma (meme esprit que les autres modules de mini-jeu qui
 * s'abonnent a "room.game-started" sans connaitre RoomsGateway).
 */
@Injectable()
export class PersistenceListener {
	constructor(private readonly persistence: PersistenceService) {}

	@OnEvent(PERSISTENCE_EVENTS.ROOM_CREATED)
	handleRoomCreated(payload: { room: Room }) {
		void this.persistence.recordRoomCreated(payload.room);
	}

	@OnEvent(PERSISTENCE_EVENTS.ROOM_CLOSED)
	handleRoomClosed(payload: { roomCode: string }) {
		void this.persistence.recordRoomClosed(payload.roomCode);
	}

	@OnEvent(PERSISTENCE_EVENTS.ROUND_FINISHED)
	handleRoundFinished(payload: {
		roomCode: string;
		result: RoundResult;
		playerCount: number;
		players: { id: string; anonId: string }[];
	}) {
		void this.persistence.recordRoundFinished(payload.roomCode, payload.result, payload.playerCount);
		if (payload.result.gameId !== "free-play") {
			void this.persistence.recordGameCompleted(
				payload.roomCode,
				payload.result.gameId,
				Object.keys(payload.result.scores),
				payload.players,
			);
		}
	}

	@OnEvent(PERSISTENCE_EVENTS.GAME_STARTED)
	handleGameStarted(payload: { roomCode: string; gameId: string; players?: { id: string; anonId: string }[] }) {
		if (!payload.players?.length) return;
		void this.persistence.recordGameStarted(payload.roomCode, payload.gameId, payload.players);
	}

	@OnEvent(PERSISTENCE_EVENTS.SOCKET_CONNECTED)
	handleSocketConnected(payload: { anonId: string; socketId: string; roomCode?: string }) {
		void this.persistence.recordConnection(payload.anonId, payload.socketId, payload.roomCode);
	}

	@OnEvent(PERSISTENCE_EVENTS.SOCKET_DISCONNECTED)
	handleSocketDisconnected(payload: { anonId: string; socketId: string; roomCode?: string; gameId?: string | null }) {
		void this.persistence.recordDisconnection(payload.anonId, payload.socketId, payload.roomCode);
		if (payload.gameId && payload.roomCode) {
			void this.persistence.recordGameAbandoned(payload.anonId, payload.roomCode, payload.gameId);
		}
	}
}
