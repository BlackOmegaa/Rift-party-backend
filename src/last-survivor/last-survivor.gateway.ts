import { ALLOWED_ORIGINS } from "../common/constants/cors.constants";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { LastSurvivorService } from './last-survivor.service';
import { RoomsService } from '../rooms/rooms.service';
import { LAST_SURVIVOR_EVENTS, ROOM_EVENTS } from '../common/constants/socket-events.constants';

const GAME_ID = 'last-survivor';
/** Pool complet en standalone (7 eliminations), reduit en Party Mix pour tenir dans un segment. */
const STANDALONE_POOL_SIZE = 8;
const MIX_POOL_SIZE = 5;

/**
 * Gateway du mini-jeu "Last Survivor". Meme convention que VotePartyGateway :
 * jamais de join/leave de room ici, toujours RoomsService.getRoomBySocket().
 */
@WebSocketGateway({ cors: { origin: ALLOWED_ORIGINS, credentials: true } })
export class LastSurvivorGateway {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly lastSurvivorService: LastSurvivorService,
    private readonly roomsService: RoomsService,
  ) {}

  @OnEvent('room.game-started')
  handleGameStarted(payload: { roomCode: string; gameId: string }) {
    if (payload.gameId !== GAME_ID) return;
    const room = this.roomsService.getRoom(payload.roomCode);
    if (!room) return;

    const poolSize = room.activeMix?.status === 'running' ? MIX_POOL_SIZE : STANDALONE_POOL_SIZE;
    const players = room.players.map((p) => ({ id: p.id, pseudo: p.pseudo }));
    const info = this.lastSurvivorService.startSession(
      payload.roomCode,
      players,
      poolSize,
      room.settings.roundTimeSec,
      (code) => this.handleTimeout(code),
    );
    this.server.to(payload.roomCode).emit(LAST_SURVIVOR_EVENTS.START, info);
  }

  @OnEvent('room.player-left')
  handlePlayerLeft(payload: { roomCode: string; playerId: string }) {
    const check = this.lastSurvivorService.removePlayer(payload.roomCode, payload.playerId);
    if (check?.allVoted) this.revealRound(payload.roomCode);
  }

  @SubscribeMessage(LAST_SURVIVOR_EVENTS.REQUEST_STATE)
  handleRequestState(@ConnectedSocket() client: Socket) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room) return;
    client.emit(
      LAST_SURVIVOR_EVENTS.STATE,
      this.lastSurvivorService.getSnapshot(room.code, client.id),
    );
  }

  @SubscribeMessage(LAST_SURVIVOR_EVENTS.VOTE)
  handleVote(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: { targetLabel: string | null },
  ) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room) {
      client.emit(ROOM_EVENTS.ERROR, { message: "Tu n'es dans aucune room." });
      return;
    }
    try {
      const progress = this.lastSurvivorService.submitVote(
        room.code,
        client.id,
        dto.targetLabel ?? null,
      );
      this.server.to(room.code).emit(LAST_SURVIVOR_EVENTS.VOTE_PROGRESS, {
        votedCount: progress.votedCount,
        expectedCount: progress.expectedCount,
      });
      if (progress.allVoted) this.revealRound(room.code);
    } catch (err) {
      client.emit(ROOM_EVENTS.ERROR, { message: (err as Error).message });
    }
  }

  @SubscribeMessage(LAST_SURVIVOR_EVENTS.NEXT)
  handleNext(@ConnectedSocket() client: Socket) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room || room.hostId !== client.id) return;
    try {
      if (this.lastSurvivorService.isFinished(room.code)) {
        this.finishGame(room.code);
        return;
      }
      const info = this.lastSurvivorService.nextRound(
        room.code,
        room.settings.roundTimeSec,
        (code) => this.handleTimeout(code),
      );
      this.server.to(room.code).emit(LAST_SURVIVOR_EVENTS.ROUND, info);
    } catch (err) {
      client.emit(ROOM_EVENTS.ERROR, { message: (err as Error).message });
    }
  }

  /** Temps ecoule pendant le vote : les retardataires sont comptes en abstention et l'elimination est revelee. */
  private handleTimeout(roomCode: string) {
    if (this.lastSurvivorService.phaseOf(roomCode) !== 'voting') return;
    this.revealRound(roomCode);
  }

  private revealRound(roomCode: string) {
    const result = this.lastSurvivorService.revealRound(roomCode);
    this.server.to(roomCode).emit(LAST_SURVIVOR_EVENTS.ROUND_RESULT, result);
  }

  private finishGame(roomCode: string) {
    const result = this.lastSurvivorService.computeResults(roomCode);
    this.server.to(roomCode).emit(LAST_SURVIVOR_EVENTS.RESULTS, result);

    const room = this.roomsService.getRoom(roomCode);
    if (!room || room.activeMix?.status === 'running') {
      // En Party Mix, chaque client signale `party:segment-complete` lui-meme
      // une fois l'ecran de resultats vu (meme pattern que Vote Party/Loldle).
      return;
    }

    const updatedRoom = this.roomsService.recordRoundResult(roomCode, {
      gameId: GAME_ID,
      roundNumber: room.roundHistory.length + 1,
      scores: result.scores,
      summary: result.summary,
      finishedAt: new Date().toISOString(),
    });
    if (updatedRoom) {
      this.server
        .to(roomCode)
        .emit(
          ROOM_EVENTS.ROUND_FINISHED,
          updatedRoom.roundHistory[updatedRoom.roundHistory.length - 1],
        );
      this.server.to(roomCode).emit(ROOM_EVENTS.STATE, updatedRoom);
    }
  }
}
