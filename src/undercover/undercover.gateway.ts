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
import { UndercoverService } from './undercover.service';
import { RoomsService } from '../rooms/rooms.service';
import { ROOM_EVENTS, UNDERCOVER_EVENTS } from '../common/constants/socket-events.constants';
import { PERSISTENCE_EVENTS } from '../common/constants/internal-events.constants';

const GAME_ID = 'undercover-champion';
const VOTE_TIMEOUT_MS = 45_000;

/**
 * Gateway du mini-jeu Undercover Champion. Ne gere jamais le join/leave de
 * room : elle retrouve toujours la room courante via RoomsService.getRoomBySocket()
 * (meme convention que DraftGateway).
 */
@WebSocketGateway({ cors: { origin: ALLOWED_ORIGINS, credentials: true } })
export class UndercoverGateway {
  @WebSocketServer() server!: Server;

  private readonly voteTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly undercoverService: UndercoverService,
    private readonly roomsService: RoomsService,
  ) {}

  @OnEvent('room.game-started')
  handleGameStarted(payload: { roomCode: string; gameId: string }) {
    if (payload.gameId !== GAME_ID) return;
    const room = this.roomsService.getRoom(payload.roomCode);
    if (!room) return;

    const players = room.players.map((p) => ({ id: p.id, pseudo: p.pseudo }));
    const { turnOrder, turnDurationMs } = this.undercoverService.startSession(
      payload.roomCode,
      players,
      room.settings.roundTimeSec,
    );
    this.server
      .to(payload.roomCode)
      .emit(UNDERCOVER_EVENTS.START, { turnOrder, turnDurationMs });

    // Reveal prive : chaque socket est deja membre d'une room nommee par son
    // propre id (comportement natif de socket.io), donc `server.to(playerId)`
    // n'atteint jamais que ce joueur.
    for (const player of players) {
      const word = this.undercoverService.getPrivateWord(payload.roomCode, player.id);
      if (word) this.server.to(player.id).emit(UNDERCOVER_EVENTS.REVEAL, { word });
    }
  }

  /**
   * Demandee par le client des qu'il monte son composant (au lieu de compter
   * uniquement sur les broadcasts one-shot ci-dessus, qui peuvent arriver
   * avant que ses listeners ne soient attaches et donc etre manques).
   */
  @SubscribeMessage(UNDERCOVER_EVENTS.REQUEST_STATE)
  handleRequestState(@ConnectedSocket() client: Socket) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room) return;
    client.emit(
      UNDERCOVER_EVENTS.STATE,
      this.undercoverService.getSnapshot(room.code, client.id),
    );
  }

  @SubscribeMessage(UNDERCOVER_EVENTS.REVEAL_READY)
  handleRevealReady(@ConnectedSocket() client: Socket) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room) return;
    const allReady = this.undercoverService.markReady(room.code, client.id);
    this.server
      .to(room.code)
      .emit(UNDERCOVER_EVENTS.REVEAL_PROGRESS, this.undercoverService.revealProgress(room.code));
    if (!allReady) return;

    this.beginTurnsSkippingDeparted(room.code);
  }

  /** Demarre la phase de tours. Si le premier tour revient a un joueur deja parti, il est consomme immediatement (mot vide) au lieu de faire attendre le lobby jusqu'au timer. */
  private beginTurnsSkippingDeparted(roomCode: string): void {
    const turn = this.undercoverService.beginTurns(roomCode, (code) =>
      this.handleTurnTimeout(code),
    );
    if (!turn) return;
    if (!this.undercoverService.isDeparted(roomCode, turn.playerId)) {
      this.server.to(roomCode).emit(UNDERCOVER_EVENTS.TURN_STARTED, turn);
      return;
    }
    this.handleTurnTimeout(roomCode);
  }

  @SubscribeMessage(UNDERCOVER_EVENTS.SUBMIT_WORD)
  handleSubmitWord(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: { word: string },
  ) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room) {
      client.emit(ROOM_EVENTS.ERROR, { message: "Tu n'es dans aucune room." });
      return;
    }
    try {
      const { entry } = this.undercoverService.submitWord(room.code, client.id, dto.word);
      this.server.to(room.code).emit(UNDERCOVER_EVENTS.WORD_SUBMITTED, entry);
      this.advanceOrOpenVote(room.code);
    } catch (err) {
      client.emit(ROOM_EVENTS.ERROR, { message: (err as Error).message });
    }
  }

  @SubscribeMessage(UNDERCOVER_EVENTS.VOTE)
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
      const connectedIds = room.players.map((p) => p.id);
      const allVoted = this.undercoverService.submitVote(
        room.code,
        client.id,
        dto.targetId,
        connectedIds,
      );
      this.server
        .to(room.code)
        .emit(
          UNDERCOVER_EVENTS.VOTE_PROGRESS,
          this.undercoverService.getVoteProgress(room.code),
        );
      if (allVoted) this.finishGame(room.code);
    } catch (err) {
      client.emit(ROOM_EVENTS.ERROR, { message: (err as Error).message });
    }
  }

  /**
   * Depart d'un joueur (deco OU leave volontaire) : chaque phase a une attente
   * qui peut ne guetter que lui — reveal (quorum de prets), tours (son timer),
   * vote (quorum de votants). Sans re-check ici, la manche resterait figee
   * jusqu'au timer de la phase... ou pour toujours dans le cas du reveal, qui
   * n'en a pas.
   */
  @OnEvent('room.player-left')
  handlePlayerLeft(payload: { roomCode: string; playerId: string }) {
    const room = this.roomsService.getRoom(payload.roomCode);
    if (!room) return;
    const phase = this.undercoverService.phaseOf(payload.roomCode);
    if (!phase) return;
    this.undercoverService.markDeparted(payload.roomCode, payload.playerId);

    if (phase === 'reveal') {
      this.server
        .to(payload.roomCode)
        .emit(
          UNDERCOVER_EVENTS.REVEAL_PROGRESS,
          this.undercoverService.revealProgress(payload.roomCode),
        );
      if (this.undercoverService.isRevealComplete(payload.roomCode)) {
        this.beginTurnsSkippingDeparted(payload.roomCode);
      }
      return;
    }

    if (phase === 'turn1' || phase === 'turn2') {
      // C'etait son tour : avance tout de suite (mot vide) au lieu de laisser
      // le lobby regarder un compte a rebours pour un joueur qui n'est plus la.
      if (
        this.undercoverService.currentTurnPlayerId(payload.roomCode) ===
        payload.playerId
      ) {
        this.handleTurnTimeout(payload.roomCode);
      }
      return;
    }

    if (phase === 'vote') {
      const connectedIds = room.players.map((p) => p.id);
      this.server
        .to(payload.roomCode)
        .emit(
          UNDERCOVER_EVENTS.VOTE_PROGRESS,
          this.undercoverService.getVoteProgress(payload.roomCode),
        );
      if (this.undercoverService.isVoteComplete(payload.roomCode, connectedIds)) {
        this.finishGame(payload.roomCode);
      }
    }
  }

  /** Room fermee definitivement : purge session + timers, sinon une manche abandonnee reste en memoire pour toujours. */
  @OnEvent(PERSISTENCE_EVENTS.ROOM_CLOSED)
  handleRoomClosed(payload: { roomCode: string }) {
    this.clearVoteTimeout(payload.roomCode);
    this.undercoverService.clearSession(payload.roomCode);
  }

  private handleTurnTimeout(roomCode: string) {
    const entry = this.undercoverService.autoAdvanceOnTimeout(roomCode);
    if (!entry) return;
    this.server.to(roomCode).emit(UNDERCOVER_EVENTS.WORD_SUBMITTED, entry);
    this.advanceOrOpenVote(roomCode);
  }

  private advanceOrOpenVote(roomCode: string) {
    // Boucle : les tours des joueurs partis sont consommes immediatement (mot
    // vide) au lieu d'imposer un timer complet par tour fantome. Terminaison
    // garantie : chaque iteration consomme un tour, jusqu'a la phase vote.
    for (;;) {
      if (this.undercoverService.phaseOf(roomCode) === 'vote') {
        this.server.to(roomCode).emit(UNDERCOVER_EVENTS.VOTE_PHASE, {});
        this.armVoteTimeout(roomCode);
        return;
      }
      const turn = this.undercoverService.nextTurn(roomCode, (code) =>
        this.handleTurnTimeout(code),
      );
      if (!turn) return;
      if (!this.undercoverService.isDeparted(roomCode, turn.playerId)) {
        this.server.to(roomCode).emit(UNDERCOVER_EVENTS.TURN_STARTED, turn);
        return;
      }
      const entry = this.undercoverService.autoAdvanceOnTimeout(roomCode);
      if (!entry) return;
      this.server.to(roomCode).emit(UNDERCOVER_EVENTS.WORD_SUBMITTED, entry);
    }
  }

  /** Filet de securite : si un joueur connecte reste inactif sans jamais voter, le vote ne doit pas bloquer la room indefiniment. */
  private armVoteTimeout(roomCode: string): void {
    this.clearVoteTimeout(roomCode);
    this.voteTimeouts.set(
      roomCode,
      setTimeout(() => {
        this.voteTimeouts.delete(roomCode);
        if (this.undercoverService.phaseOf(roomCode) === 'vote') {
          this.finishGame(roomCode);
        }
      }, VOTE_TIMEOUT_MS),
    );
  }

  private clearVoteTimeout(roomCode: string): void {
    const existing = this.voteTimeouts.get(roomCode);
    if (existing) {
      clearTimeout(existing);
      this.voteTimeouts.delete(roomCode);
    }
  }

  private finishGame(roomCode: string) {
    this.clearVoteTimeout(roomCode);
    const result = this.undercoverService.computeResults(roomCode);
    this.server.to(roomCode).emit(UNDERCOVER_EVENTS.RESULTS, result);

    const room = this.roomsService.getRoom(roomCode);
    if (!room || room.activeMix?.status === 'running') {
      // En Party Mix, chaque client signale `party:segment-complete` lui-meme
      // une fois l'animation de resultats vue (meme pattern que Draft Battle).
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
