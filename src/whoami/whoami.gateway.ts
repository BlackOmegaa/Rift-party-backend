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
import { WhoamiService } from './whoami.service';
import { RoomsService } from '../rooms/rooms.service';
import { ROOM_EVENTS, WHOAMI_EVENTS } from '../common/constants/socket-events.constants';
import { PERSISTENCE_EVENTS } from '../common/constants/internal-events.constants';
import { WhoamiTurnState } from './interfaces/whoami.interface';

const GAME_ID = 'qui-suis-je';

/**
 * Gateway du mini-jeu "Qui suis-je ?". Meme convention que les autres gateways
 * de mini-jeu : jamais de join/leave de room ici, toujours getRoomBySocket().
 *
 * Particularite : les assignations de champions sont PERSONNALISEES (chacun voit
 * le champion des autres mais jamais le sien), donc START/STATE sont emis
 * socket par socket au lieu d'un broadcast room.
 */
@WebSocketGateway({ cors: { origin: ALLOWED_ORIGINS, credentials: true } })
export class WhoamiGateway {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly whoamiService: WhoamiService,
    private readonly roomsService: RoomsService,
  ) {}

  @OnEvent('room.game-started')
  handleGameStarted(payload: { roomCode: string; gameId: string }) {
    if (payload.gameId !== GAME_ID) return;
    const room = this.roomsService.getRoom(payload.roomCode);
    if (!room) return;

    const players = room.players.map((p) => ({ id: p.id, pseudo: p.pseudo }));
    this.whoamiService.startSession(
      payload.roomCode,
      players,
      room.settings.roundTimeSec,
      (code) => this.handleTimeout(code),
    );
    this.emitPersonalizedState(payload.roomCode);
  }

  @OnEvent('room.player-left')
  handlePlayerLeft(payload: { roomCode: string; playerId: string }) {
    const outcome = this.whoamiService.removePlayer(payload.roomCode, payload.playerId);
    if (!outcome) return;
    this.applyOutcome(payload.roomCode, outcome);
    // La liste des cibles a change pour tout le monde.
    if (this.whoamiService.hasSession(payload.roomCode)) this.emitPersonalizedState(payload.roomCode);
  }

  /** Room fermee definitivement : purge session + timer, sinon une manche abandonnee reste en memoire pour toujours. */
  @OnEvent(PERSISTENCE_EVENTS.ROOM_CLOSED)
  handleRoomClosed(payload: { roomCode: string }) {
    this.whoamiService.clearRoom(payload.roomCode);
  }

  @SubscribeMessage(WHOAMI_EVENTS.REQUEST_STATE)
  handleRequestState(@ConnectedSocket() client: Socket) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room) return;
    client.emit(WHOAMI_EVENTS.STATE, this.whoamiService.getSnapshot(room.code, client.id));
  }

  @SubscribeMessage(WHOAMI_EVENTS.ANSWER)
  handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: { value: boolean },
  ) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room) return;
    try {
      const progress = this.whoamiService.submitAnswer(room.code, client.id, !!dto.value);
      this.server.to(room.code).emit(WHOAMI_EVENTS.ANSWER_PROGRESS, {
        answeredCount: progress.answeredCount,
        expectedCount: progress.expectedCount,
      });
      if (progress.allAnswered) {
        const turn = this.whoamiService.closeQuestion(room.code);
        this.server.to(room.code).emit(WHOAMI_EVENTS.TURN, turn);
      }
    } catch (err) {
      client.emit(ROOM_EVENTS.ERROR, { message: (err as Error).message });
    }
  }

  @SubscribeMessage(WHOAMI_EVENTS.NEXT_QUESTION)
  handleNextQuestion(@ConnectedSocket() client: Socket) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room) return;
    try {
      const turn = this.whoamiService.nextQuestion(room.code, client.id);
      this.server.to(room.code).emit(WHOAMI_EVENTS.TURN, turn);
    } catch (err) {
      client.emit(ROOM_EVENTS.ERROR, { message: (err as Error).message });
    }
  }

  @SubscribeMessage(WHOAMI_EVENTS.PASS)
  handlePass(@ConnectedSocket() client: Socket) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room) return;
    try {
      const outcome = this.whoamiService.passTurn(room.code, client.id);
      this.applyOutcome(room.code, outcome);
    } catch (err) {
      client.emit(ROOM_EVENTS.ERROR, { message: (err as Error).message });
    }
  }

  @SubscribeMessage(WHOAMI_EVENTS.GUESS)
  handleGuess(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: { champion: string },
  ) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room) return;
    try {
      const { result, turn, finished } = this.whoamiService.submitGuess(
        room.code,
        client.id,
        dto.champion ?? '',
      );
      this.server.to(room.code).emit(WHOAMI_EVENTS.GUESS_RESULT, result);
      // found/failed ont change : chacun doit rafraichir sa vue des cartes.
      if (!finished) this.emitPersonalizedState(room.code);
      this.applyOutcome(room.code, { turn, finished });
    } catch (err) {
      client.emit(ROOM_EVENTS.ERROR, { message: (err as Error).message });
    }
  }

  private handleTimeout(roomCode: string) {
    const outcome = this.whoamiService.handleTimeout(roomCode);
    this.applyOutcome(roomCode, outcome);
  }

  private applyOutcome(
    roomCode: string,
    outcome: { closedQuestion?: WhoamiTurnState; turn?: WhoamiTurnState | null; finished?: boolean },
  ) {
    if (outcome.closedQuestion) {
      this.server.to(roomCode).emit(WHOAMI_EVENTS.TURN, outcome.closedQuestion);
      return;
    }
    if (outcome.finished) {
      this.finishGame(roomCode);
      return;
    }
    if (outcome.turn) {
      this.server.to(roomCode).emit(WHOAMI_EVENTS.TURN, outcome.turn);
    }
  }

  /** START/STATE personnalises : chacun recoit les cartes des autres, jamais la sienne. */
  private emitPersonalizedState(roomCode: string) {
    for (const player of this.whoamiService.getPlayers(roomCode)) {
      this.server.to(player.id).emit(WHOAMI_EVENTS.START, {
        assignments: this.whoamiService.assignmentsFor(roomCode, player.id),
        turn: this.whoamiService.turnStateOf(roomCode),
      });
    }
  }

  private finishGame(roomCode: string) {
    const result = this.whoamiService.computeResults(roomCode);
    this.server.to(roomCode).emit(WHOAMI_EVENTS.RESULTS, result);

    const room = this.roomsService.getRoom(roomCode);
    if (!room || room.activeMix?.status === 'running') return;

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
