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
import { CroquisService } from './croquis.service';
import { RoomsService } from '../rooms/rooms.service';
import { CROQUIS_EVENTS, ROOM_EVENTS } from '../common/constants/socket-events.constants';
import { PERSISTENCE_EVENTS } from '../common/constants/internal-events.constants';

const GAME_ID = 'croquis';

/**
 * Gateway du mini-jeu "Croquis". Le champion a dessiner est PERSONNEL et
 * secret pour les autres : START est emis socket par socket (meme convention
 * que WhoamiGateway), le reste est broadcast.
 */
@WebSocketGateway({ cors: { origin: ALLOWED_ORIGINS, credentials: true } })
export class CroquisGateway {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly croquisService: CroquisService,
    private readonly roomsService: RoomsService,
  ) {}

  @OnEvent('room.game-started')
  handleGameStarted(payload: { roomCode: string; gameId: string }) {
    if (payload.gameId !== GAME_ID) return;
    const room = this.roomsService.getRoom(payload.roomCode);
    if (!room) return;

    const players = room.players.map((p) => ({ id: p.id, pseudo: p.pseudo }));
    const info = this.croquisService.startSession(
      payload.roomCode,
      players,
      room.settings.roundTimeSec,
      (code) => this.handleTimeout(code),
    );
    for (const player of players) {
      this.server.to(player.id).emit(CROQUIS_EVENTS.START, {
        champion: this.croquisService.championOf(payload.roomCode, player.id),
        drawingTimeSec: info.drawingTimeSec,
        deadline: info.deadline,
      });
    }
  }

  @OnEvent('room.player-left')
  handlePlayerLeft(payload: { roomCode: string; playerId: string }) {
    const outcome = this.croquisService.removePlayer(payload.roomCode, payload.playerId);
    if (!outcome) return;
    if (outcome.allSubmitted) this.openGallery(payload.roomCode);
    else if (outcome.allGuessed) this.reveal(payload.roomCode);
  }

  @OnEvent(PERSISTENCE_EVENTS.ROOM_CLOSED)
  handleRoomClosed(payload: { roomCode: string }) {
    // Le dernier joueur parti n'emet pas `room.player-left` : sans ce nettoyage,
    // la session (et son timer arme) survivrait a la fermeture de la room.
    this.croquisService.clearRoom(payload.roomCode);
  }

  @SubscribeMessage(CROQUIS_EVENTS.REQUEST_STATE)
  handleRequestState(@ConnectedSocket() client: Socket) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room) return;
    client.emit(CROQUIS_EVENTS.STATE, this.croquisService.getSnapshot(room.code, client.id));
  }

  @SubscribeMessage(CROQUIS_EVENTS.SUBMIT_DRAWING)
  handleSubmitDrawing(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: { image: string },
  ) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room) return;
    try {
      const progress = this.croquisService.submitDrawing(room.code, client.id, dto.image ?? '');
      this.server.to(room.code).emit(CROQUIS_EVENTS.DRAWING_PROGRESS, {
        submittedCount: progress.submittedCount,
        expectedCount: progress.expectedCount,
      });
      if (progress.allSubmitted) this.openGallery(room.code);
    } catch (err) {
      client.emit(ROOM_EVENTS.ERROR, { message: (err as Error).message });
    }
  }

  @SubscribeMessage(CROQUIS_EVENTS.GUESS)
  handleGuess(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: { champion: string },
  ) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room) return;
    try {
      const progress = this.croquisService.submitGuess(room.code, client.id, dto.champion ?? '');
      this.server.to(room.code).emit(CROQUIS_EVENTS.GUESS_PROGRESS, {
        guessedCount: progress.guessedCount,
        expectedCount: progress.expectedCount,
      });
      if (progress.allGuessed) this.reveal(room.code);
    } catch (err) {
      client.emit(ROOM_EVENTS.ERROR, { message: (err as Error).message });
    }
  }

  @SubscribeMessage(CROQUIS_EVENTS.NEXT)
  handleNext(@ConnectedSocket() client: Socket) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room || room.hostId !== client.id) return;
    try {
      this.advanceGallery(room.code);
    } catch (err) {
      client.emit(ROOM_EVENTS.ERROR, { message: (err as Error).message });
    }
  }

  /** Avance la galerie (host ou filet de securite) : dessin suivant ou fin de partie. */
  private advanceGallery(roomCode: string) {
    if (this.croquisService.isLastDrawing(roomCode)) {
      this.finishGame(roomCode);
      return;
    }
    const item = this.croquisService.nextDrawing(roomCode);
    this.server.to(roomCode).emit(CROQUIS_EVENTS.GALLERY_ITEM, item);
    // Session reduite a l'artiste seul : personne ne devinera, on revele direct.
    if (this.croquisService.noGuesserExpected(roomCode)) this.reveal(roomCode);
  }

  /** Timeout : fin de la phase dessin (retardataires sans dessin), du dessin courant (devinettes manquantes) ou du reveal (host qui ne suit plus). */
  private handleTimeout(roomCode: string) {
    const phase = this.croquisService.phaseOf(roomCode);
    if (phase === 'drawing') this.openGallery(roomCode);
    else if (phase === 'guessing') this.reveal(roomCode);
    else if (phase === 'reveal') this.advanceGallery(roomCode);
  }

  private openGallery(roomCode: string) {
    const item = this.croquisService.startGallery(roomCode);
    if (!item) {
      // Personne n'a rendu de dessin : partie terminee directement.
      this.finishGame(roomCode);
      return;
    }
    this.server.to(roomCode).emit(CROQUIS_EVENTS.GALLERY_ITEM, item);
    // Session reduite a l'artiste seul : personne ne devinera, on revele direct.
    if (this.croquisService.noGuesserExpected(roomCode)) this.reveal(roomCode);
  }

  private reveal(roomCode: string) {
    const reveal = this.croquisService.revealCurrent(roomCode);
    this.server.to(roomCode).emit(CROQUIS_EVENTS.REVEAL, reveal);
  }

  private finishGame(roomCode: string) {
    const result = this.croquisService.computeResults(roomCode);
    this.server.to(roomCode).emit(CROQUIS_EVENTS.RESULTS, result);

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
