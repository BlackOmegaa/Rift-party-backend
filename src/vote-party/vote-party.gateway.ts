import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { VotePartyService } from './vote-party.service';
import { RoomsService } from '../rooms/rooms.service';
import { ROOM_EVENTS, VOTE_PARTY_EVENTS } from '../common/constants/socket-events.constants';

const GAME_ID = 'vote-party';
const DEFAULT_ROUNDS = 5;

/**
 * Gateway du mini-jeu "Vote Party". Meme convention que LoldleGateway :
 * jamais de join/leave de room ici, toujours RoomsService.getRoomBySocket().
 */
@WebSocketGateway({ cors: true })
export class VotePartyGateway {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly votePartyService: VotePartyService,
    private readonly roomsService: RoomsService,
  ) {}

  @OnEvent('room.game-started')
  handleGameStarted(payload: { roomCode: string; gameId: string }) {
    if (payload.gameId !== GAME_ID) return;
    const room = this.roomsService.getRoom(payload.roomCode);
    if (!room) return;

    // En Party Mix, la taille du segment est portee par activeMix ; en standalone,
    // c'est le reglage de room (slider "Nombre de manches" de l'host).
    const totalRounds =
      room.activeMix?.status === 'running'
        ? room.activeMix.currentRoundSize || DEFAULT_ROUNDS
        : (room.settings.roundsByGame[GAME_ID] ?? DEFAULT_ROUNDS);

    const players = room.players.map((p) => ({ id: p.id, pseudo: p.pseudo }));
    const info = this.votePartyService.startSession(
      payload.roomCode,
      players,
      totalRounds,
      room.settings.roundTimeSec,
      (code) => this.handleTimeout(code),
    );
    this.server.to(payload.roomCode).emit(VOTE_PARTY_EVENTS.START, info);
  }

  @OnEvent('room.player-left')
  handlePlayerLeft(payload: { roomCode: string; playerId: string }) {
    const check = this.votePartyService.removePlayer(payload.roomCode, payload.playerId);
    if (check?.allVoted) this.revealRound(payload.roomCode);
  }

  @SubscribeMessage(VOTE_PARTY_EVENTS.REQUEST_STATE)
  handleRequestState(@ConnectedSocket() client: Socket) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room) return;
    client.emit(VOTE_PARTY_EVENTS.STATE, this.votePartyService.getSnapshot(room.code, client.id));
  }

  @SubscribeMessage(VOTE_PARTY_EVENTS.VOTE)
  handleVote(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: { targetId: string | null },
  ) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room) {
      client.emit(ROOM_EVENTS.ERROR, { message: "Tu n'es dans aucune room." });
      return;
    }
    try {
      const progress = this.votePartyService.submitVote(room.code, client.id, dto.targetId ?? null);
      this.server.to(room.code).emit(VOTE_PARTY_EVENTS.VOTE_PROGRESS, {
        votedCount: progress.votedCount,
        expectedCount: progress.expectedCount,
      });
      if (progress.allVoted) this.revealRound(room.code);
    } catch (err) {
      client.emit(ROOM_EVENTS.ERROR, { message: (err as Error).message });
    }
  }

  @SubscribeMessage(VOTE_PARTY_EVENTS.NEXT)
  handleNext(@ConnectedSocket() client: Socket) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room || room.hostId !== client.id) return;
    try {
      if (this.votePartyService.isLastRound(room.code)) {
        this.finishGame(room.code);
        return;
      }
      const info = this.votePartyService.nextRound(
        room.code,
        room.settings.roundTimeSec,
        (code) => this.handleTimeout(code),
      );
      this.server.to(room.code).emit(VOTE_PARTY_EVENTS.QUESTION, info);
    } catch (err) {
      client.emit(ROOM_EVENTS.ERROR, { message: (err as Error).message });
    }
  }

  /** Temps ecoule pendant le vote : les retardataires sont comptes en abstention et la manche est revelee. */
  private handleTimeout(roomCode: string) {
    if (this.votePartyService.phaseOf(roomCode) !== 'voting') return;
    this.revealRound(roomCode);
  }

  private revealRound(roomCode: string) {
    const result = this.votePartyService.revealRound(roomCode);
    this.server.to(roomCode).emit(VOTE_PARTY_EVENTS.ROUND_RESULT, result);
  }

  private finishGame(roomCode: string) {
    const result = this.votePartyService.computeResults(roomCode);
    this.server.to(roomCode).emit(VOTE_PARTY_EVENTS.RESULTS, result);

    const room = this.roomsService.getRoom(roomCode);
    if (!room || room.activeMix?.status === 'running') {
      // En Party Mix, chaque client signale `party:segment-complete` lui-meme
      // une fois l'ecran de resultats vu (meme pattern que Loldle/Brume).
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
