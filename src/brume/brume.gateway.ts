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
import { BrumeService } from './brume.service';
import { RoomsService } from '../rooms/rooms.service';
import { BRUME_EVENTS, ROOM_EVENTS } from '../common/constants/socket-events.constants';
import {
  BrumeChatChannel,
  BrumeNightActionType,
} from './interfaces/brume.interface';

const GAME_ID = 'brume';

/**
 * Gateway du mini-jeu "La Brume". Meme convention que UndercoverGateway :
 * jamais de join/leave de room ici, toujours RoomsService.getRoomBySocket().
 */
@WebSocketGateway({ cors: { origin: ALLOWED_ORIGINS, credentials: true } })
export class BrumeGateway {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly brumeService: BrumeService,
    private readonly roomsService: RoomsService,
  ) {}

  @OnEvent('room.game-started')
  handleGameStarted(payload: { roomCode: string; gameId: string }) {
    if (payload.gameId !== GAME_ID) return;
    const room = this.roomsService.getRoom(payload.roomCode);
    if (!room) return;

    const players = room.players.map((p) => ({ id: p.id, pseudo: p.pseudo }));
    this.brumeService.startSession(payload.roomCode, players, room.settings.roundTimeSec);
    this.server.to(payload.roomCode).emit(BRUME_EVENTS.START, { players });

    // Reveal prive : role + team + kit du champion assigne.
    for (const player of players) {
      const rolePayload = this.brumeService.getRolePayload(payload.roomCode, player.id);
      if (rolePayload) this.server.to(player.id).emit(BRUME_EVENTS.REVEAL, rolePayload);
    }
  }

  @SubscribeMessage(BRUME_EVENTS.REQUEST_STATE)
  handleRequestState(@ConnectedSocket() client: Socket) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room) return;
    client.emit(BRUME_EVENTS.STATE, this.brumeService.getSnapshot(room.code, client.id));
  }

  @SubscribeMessage(BRUME_EVENTS.REVEAL_READY)
  handleRevealReady(@ConnectedSocket() client: Socket) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room) return;
    const allReady = this.brumeService.markReady(room.code, client.id);
    this.server
      .to(room.code)
      .emit(BRUME_EVENTS.REVEAL_PROGRESS, this.brumeService.revealProgress(room.code));
    if (!allReady) return;
    this.startNight(room.code);
  }

  @SubscribeMessage(BRUME_EVENTS.NIGHT_ACTION)
  handleNightAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: { action: BrumeNightActionType; targetId?: string },
  ) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room) {
      client.emit(ROOM_EVENTS.ERROR, { message: "Tu n'es dans aucune room." });
      return;
    }
    try {
      const chatMessage = this.brumeService.submitNightAction(
        room.code,
        client.id,
        dto.action,
        dto.targetId,
      );
      if (chatMessage) this.emitPackChat(room.code, chatMessage);
      this.server
        .to(room.code)
        .emit(BRUME_EVENTS.NIGHT_PROGRESS, this.brumeService.nightProgress(room.code));
      // Resynchro privee : revele par ex. l'indice d'Ashe des sa resolution.
      client.emit(BRUME_EVENTS.STATE, this.brumeService.getSnapshot(room.code, client.id));
    } catch (err) {
      client.emit(ROOM_EVENTS.ERROR, { message: (err as Error).message });
    }
  }

  @SubscribeMessage(BRUME_EVENTS.VOTE)
  handleVote(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: { targetId: string },
  ) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room) {
      client.emit(ROOM_EVENTS.ERROR, { message: "Tu n'es dans aucune room." });
      return;
    }
    try {
      // Le vote de chacun peut changer autant de fois qu'il veut tant que le
      // temps n'est pas ecoule (voir demande produit) : on ne resout donc plus
      // le vote des que tout le monde a vote une fois (allVoted est ignore
      // ici), seulement au timeout (voir handleVoteTimeout) qui laisse la
      // fenetre de changement d'avis jusqu'au bout du timer.
      const { chatMessage } = this.brumeService.submitVote(
        room.code,
        client.id,
        dto.targetId,
      );
      this.server.to(room.code).emit(BRUME_EVENTS.CHAT_MESSAGE, chatMessage);
      this.server
        .to(room.code)
        .emit(BRUME_EVENTS.VOTE_PROGRESS, this.brumeService.getVoteProgress(room.code));
    } catch (err) {
      client.emit(ROOM_EVENTS.ERROR, { message: (err as Error).message });
    }
  }

  @SubscribeMessage(BRUME_EVENTS.CHAT_SEND)
  handleChatSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: { channel: BrumeChatChannel; text: string },
  ) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room) return;
    try {
      const message = this.brumeService.sendChat(room.code, client.id, dto.channel, dto.text);
      if (dto.channel === 'pack') this.emitPackChat(room.code, message);
      else this.server.to(room.code).emit(BRUME_EVENTS.CHAT_MESSAGE, message);
    } catch (err) {
      client.emit(ROOM_EVENTS.ERROR, { message: (err as Error).message });
    }
  }

  private emitPackChat(roomCode: string, message: ReturnType<BrumeService['sendChat']>) {
    for (const player of this.brumeService.getPackMembers(roomCode)) {
      this.server.to(player.id).emit(BRUME_EVENTS.CHAT_MESSAGE, message);
    }
  }

  private startNight(roomCode: string) {
    const info = this.brumeService.beginNight(roomCode, (code) => this.handleNightTimeout(code));
    if (!info) return;
    this.server.to(roomCode).emit(BRUME_EVENTS.NIGHT_STARTED, info);
  }

  private handleNightTimeout(roomCode: string) {
    const { recap, victory } = this.brumeService.resolveNight(roomCode);
    this.server.to(roomCode).emit(BRUME_EVENTS.DAWN, recap);
    this.pushPrivateResync(roomCode);

    if (victory) {
      this.finishGame(roomCode, victory);
      return;
    }
    const info = this.brumeService.beginDay(roomCode, (code) => this.handleDayTimeout(code));
    if (info) this.server.to(roomCode).emit(BRUME_EVENTS.DAY_STARTED, info);
  }

  private handleDayTimeout(roomCode: string) {
    const info = this.brumeService.beginVote(roomCode, (code) => this.handleVoteTimeout(code));
    if (info) this.server.to(roomCode).emit(BRUME_EVENTS.VOTE_STARTED, info);
  }

  private handleVoteTimeout(roomCode: string) {
    this.resolveVotePhase(roomCode);
  }

  private resolveVotePhase(roomCode: string) {
    const { eliminatedId, victory } = this.brumeService.resolveVote(roomCode);
    const players = this.brumeService.getPlayers(roomCode);
    const eliminatedPseudo = eliminatedId
      ? players.find((p) => p.id === eliminatedId)?.pseudo ?? null
      : null;
    this.server
      .to(roomCode)
      .emit(BRUME_EVENTS.VOTE_RESULT, { eliminatedId, eliminatedPseudo });

    if (victory) {
      this.finishGame(roomCode, victory);
      return;
    }
    this.startNight(roomCode);
  }

  private pushPrivateResync(roomCode: string) {
    const room = this.roomsService.getRoom(roomCode);
    if (!room) return;
    for (const player of room.players) {
      this.server
        .to(player.id)
        .emit(BRUME_EVENTS.STATE, this.brumeService.getSnapshot(roomCode, player.id));
    }
  }

  private finishGame(roomCode: string, winner: 'predators' | 'circle' | 'kindred') {
    const result = this.brumeService.computeResults(roomCode, winner);
    this.server.to(roomCode).emit(BRUME_EVENTS.RESULTS, result);

    const room = this.roomsService.getRoom(roomCode);
    if (!room || room.activeMix?.status === 'running') {
      // En Party Mix, chaque client signale `party:segment-complete` lui-meme
      // une fois l'animation de resultats vue (meme pattern que Undercover/Draft).
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
