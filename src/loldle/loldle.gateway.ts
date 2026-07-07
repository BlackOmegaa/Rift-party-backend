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
import { LoldleService } from './loldle.service';
import { RoomsService } from '../rooms/rooms.service';
import { LOLDLE_EVENTS, ROOM_EVENTS } from '../common/constants/socket-events.constants';

const GAME_ID = 'loldle';

/**
 * Gateway du mini-jeu "Loldle". Meme convention que BrumeGateway/UndercoverGateway :
 * jamais de join/leave de room ici, toujours RoomsService.getRoomBySocket().
 */
@WebSocketGateway({ cors: { origin: ALLOWED_ORIGINS, credentials: true } })
export class LoldleGateway {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly loldleService: LoldleService,
    private readonly roomsService: RoomsService,
  ) {}

  @OnEvent('room.game-started')
  handleGameStarted(payload: { roomCode: string; gameId: string }) {
    if (payload.gameId !== GAME_ID) return;
    const room = this.roomsService.getRoom(payload.roomCode);
    if (!room) return;

    const players = room.players.map((p) => ({ id: p.id, pseudo: p.pseudo }));
    const info = this.loldleService.startSession(
      payload.roomCode,
      players,
      (code) => this.handleTimeout(code),
      room.settings.loldleWordLength,
    );
    this.server.to(payload.roomCode).emit(LOLDLE_EVENTS.START, info);
  }

  @SubscribeMessage(LOLDLE_EVENTS.REQUEST_STATE)
  handleRequestState(@ConnectedSocket() client: Socket) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room) return;
    client.emit(LOLDLE_EVENTS.STATE, this.loldleService.getSnapshot(room.code, client.id));
  }

  @SubscribeMessage(LOLDLE_EVENTS.GUESS)
  handleGuess(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: { name: string },
  ) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room) {
      client.emit(ROOM_EVENTS.ERROR, { message: "Tu n'es dans aucune room." });
      return;
    }
    try {
      const { row, feedEntry, allDone } = this.loldleService.submitGuess(
        room.code,
        client.id,
        dto.name,
      );
      client.emit(LOLDLE_EVENTS.GUESS_RESULT, row);
      this.server.to(room.code).emit(LOLDLE_EVENTS.PROGRESS, feedEntry);
      if (allDone) this.finishGame(room.code);
    } catch (err) {
      client.emit(ROOM_EVENTS.ERROR, { message: (err as Error).message });
    }
  }

  private handleTimeout(roomCode: string) {
    if (this.loldleService.phaseOf(roomCode) !== 'guessing') return;
    this.finishGame(roomCode);
  }

  private finishGame(roomCode: string) {
    const result = this.loldleService.computeResults(roomCode);
    this.server.to(roomCode).emit(LOLDLE_EVENTS.RESULTS, result);

    const room = this.roomsService.getRoom(roomCode);
    if (!room || room.activeMix?.status === 'running') {
      // En Party Mix, chaque client signale `party:segment-complete` lui-meme
      // une fois l'animation de resultats vue (meme pattern que Brume/Undercover).
      return;
    }

    const updatedRoom = this.roomsService.recordRoundResult(roomCode, {
      gameId: GAME_ID,
      roundNumber: room.roundHistory.length + 1,
      scores: result.scores,
      summary: result.summary,
      finishedAt: new Date().toISOString(),
      details: result,
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
