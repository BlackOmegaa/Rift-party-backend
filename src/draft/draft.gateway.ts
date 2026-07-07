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
import { DraftService } from './draft.service';
import { RoomsService } from '../rooms/rooms.service';
import { Room } from '../rooms/interfaces/room.interface';
import { DRAFT_EVENTS, ROOM_EVENTS } from '../common/constants/socket-events.constants';
import { PERSISTENCE_EVENTS } from '../common/constants/internal-events.constants';
import { StrategySelections } from './interfaces/draft.interface';
import { ForcedDraftEvent } from './draft.service';

const GAME_ID = 'draft-battle';

/**
 * Gateway du mini-jeu Draft Battle. Ne gere jamais le join/leave de room :
 * elle retrouve toujours la room courante via RoomsService.getRoomBySocket().
 */
const REVEAL_TIMEOUT_MS = 20_000;

/**
 * Duel en attente de reveal (clef "single" ou "round-matchIndex") : les vrais
 * joueurs concernes doivent tous signaler MATCH_SEEN (ou le timeout expire)
 * avant que le reste de la room (bracket, resume) ne voie le vainqueur.
 * Empeche un spectateur ou un joueur AFK de voir le resultat avant que les
 * duellistes n'aient fini de regarder leur propre cinematique.
 */
interface PendingReveal {
  requiredIds: Set<string>;
  seenBy: Set<string>;
  timeout: NodeJS.Timeout;
}

@WebSocketGateway({ cors: { origin: ALLOWED_ORIGINS, credentials: true } })
export class DraftGateway {
  @WebSocketServer() server!: Server;

  private readonly pendingReveals = new Map<string, PendingReveal>();

  constructor(
    private readonly draftService: DraftService,
    private readonly roomsService: RoomsService,
  ) {}

  @SubscribeMessage(DRAFT_EVENTS.MATCH_SEEN)
  handleMatchSeen(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: { key: string },
  ) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room) return;
    const fullKey = `${room.code}:${dto.key}`;
    const pending = this.pendingReveals.get(fullKey);
    if (!pending) return;
    pending.seenBy.add(client.id);
    const allSeen = [...pending.requiredIds].every((id) => pending.seenBy.has(id));
    if (allSeen) this.revealMatch(room.code, dto.key);
  }

  /** Arme l'attente de reveal pour un duel : requiredIds = les vrais joueurs de ce duel (1 seul si match clone). */
  private armReveal(roomCode: string, key: string, requiredIds: string[]) {
    const fullKey = `${roomCode}:${key}`;
    const existing = this.pendingReveals.get(fullKey);
    if (existing) clearTimeout(existing.timeout);
    const timeout = setTimeout(() => this.revealMatch(roomCode, key), REVEAL_TIMEOUT_MS);
    this.pendingReveals.set(fullKey, { requiredIds: new Set(requiredIds), seenBy: new Set(), timeout });
  }

  private revealMatch(roomCode: string, key: string) {
    const fullKey = `${roomCode}:${key}`;
    const pending = this.pendingReveals.get(fullKey);
    if (pending) clearTimeout(pending.timeout);
    this.pendingReveals.delete(fullKey);
    this.server.to(roomCode).emit(DRAFT_EVENTS.MATCH_REVEALED, { key });
  }

  @OnEvent('room.game-started')
  handleGameStarted(payload: { roomCode: string; gameId: string; forceEvent?: ForcedDraftEvent | null }) {
    if (payload.gameId !== GAME_ID) return;
    const room = this.roomsService.getRoom(payload.roomCode);
    if (!room) return;
    const participants = room.players.map((p) => p.id);
    const { budget, championsPool, strategyCategories, event } = this.draftService.startDraft(
      payload.roomCode,
      participants,
      undefined,
      payload.forceEvent,
    );
    this.server
      .to(payload.roomCode)
      .emit(DRAFT_EVENTS.START, { budget, championsPool, strategyCategories, event });

    if (this.draftService.isTournament(payload.roomCode)) {
      this.broadcastBracketState(payload.roomCode);
      this.sendRoundMatchups(payload.roomCode);
    }
  }

  /**
   * Un joueur qui rejoint la room pendant qu'une draft tourne deja n'a jamais
   * recu le broadcast initial : sans ca, son pool de champions resterait vide
   * et son ecran resterait casse. Il ne participe pas a la manche en cours
   * (voir DraftService.submitPick) mais voit au moins un etat coherent.
   */
  @OnEvent('room.player-joined')
  handlePlayerJoined(payload: { roomCode: string; playerId: string }) {
    const state = this.draftService.getResyncState(payload.roomCode);
    if (!state) return;
    this.server.to(payload.playerId).emit(DRAFT_EVENTS.START, state);
  }

  /**
   * Un joueur parti ne soumettra jamais : sans ce rattrapage, le mode simple
   * resterait bloque sur "en attente" et un bracket de tournoi attendrait son
   * pick pour toujours. Sa soumission deja faite, le cas echeant, reste
   * valable (comportement existant conserve).
   */
  @OnEvent('room.player-left')
  handlePlayerLeft(payload: { roomCode: string; playerId: string }) {
    if (!this.draftService.hasSession(payload.roomCode)) return;
    const room = this.roomsService.getRoom(payload.roomCode);
    if (!room) return;

    if (this.draftService.isTournament(payload.roomCode)) {
      // Marque le partant forfait pour ses matchs non soumis (ce round et les
      // suivants) puis relance la resolution par le meme chemin qu'une
      // soumission (reveal, bracket, avancement de round compris).
      this.draftService.markPlayerDeparted(payload.roomCode, payload.playerId);
      this.handleTournamentSubmit(payload.roomCode);
      return;
    }

    this.tryFinishSingle(room);
  }

  @OnEvent(PERSISTENCE_EVENTS.ROOM_CLOSED)
  handleRoomClosed(payload: { roomCode: string }) {
    // Le dernier joueur parti n'emet pas `room.player-left` : sans ce
    // nettoyage, la session draft et les timeouts de reveal armes (20s)
    // survivraient a la fermeture de la room.
    const prefix = `${payload.roomCode}:`;
    for (const [key, pending] of this.pendingReveals) {
      if (!key.startsWith(prefix)) continue;
      clearTimeout(pending.timeout);
      this.pendingReveals.delete(key);
    }
    this.draftService.clearRoom(payload.roomCode);
  }

  @SubscribeMessage(DRAFT_EVENTS.SUBMIT)
  handleSubmit(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    dto: {
      championIds: string[];
      rerollsUsed?: number;
      strategySelections?: Record<string, string>;
    },
  ) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room) {
      client.emit(ROOM_EVENTS.ERROR, { message: "Tu n'es dans aucune room." });
      return;
    }

    try {
      this.draftService.submitPick(
        room.code,
        client.id,
        dto.championIds,
        dto.rerollsUsed ?? 0,
        dto.strategySelections ?? {},
      );
      this.server.to(room.code).emit(DRAFT_EVENTS.PLAYER_READY, { playerId: client.id });

      if (this.draftService.isTournament(room.code)) {
        this.handleTournamentSubmit(room.code);
        return;
      }

      this.tryFinishSingle(room);
    } catch (err) {
      client.emit(ROOM_EVENTS.ERROR, { message: (err as Error).message });
    }
  }

  /**
   * Mode simple : si tous les participants encore connectes ont soumis,
   * calcule et diffuse les resultats. Appele apres chaque soumission ET apres
   * chaque depart (le partant etait peut-etre le dernier attendu).
   */
  private tryFinishSingle(room: Room) {
    const activePlayerIds = room.players.map((p) => p.id);
    if (!this.draftService.allSubmitted(room.code, activePlayerIds)) return;

    const { results } = this.draftService.computeResults(room.code);
    const duelists = results.filter((r) => r.scenario).map((r) => r.playerId);
    // On n'attend le MATCH_SEEN que des joueurs encore connectes : un joueur
    // parti apres avoir soumis ne le signalera jamais (sinon 20s de timeout).
    const connectedIds = new Set(activePlayerIds);
    const requiredIds = (duelists.length ? duelists : results.map((r) => r.playerId)).filter((id) =>
      connectedIds.has(id),
    );
    if (requiredIds.length) this.armReveal(room.code, 'single', requiredIds);
    this.server.to(room.code).emit(DRAFT_EVENTS.RESULTS, { results });
    // Duel entierement deserte : personne n'enverra MATCH_SEEN, reveal immediat.
    if (!requiredIds.length) this.revealMatch(room.code, 'single');

    const scores = this.draftService.toRoundScoresSingle(results);
    const winner = results.find((r) => r.isWinner);
    const winnerPseudo = winner
      ? (room.players.find((p) => p.id === winner.playerId)?.pseudo ?? 'Un joueur')
      : null;
    this.finishRound(room.code, {
      gameId: GAME_ID,
      scores,
      summary: winnerPseudo ? `${winnerPseudo} remporte la draft.` : 'Draft terminee.',
    });
  }

  /**
   * Relai "best effort" pour le mode spectateur en direct : pas de validation
   * ni de stockage cote serveur, juste un renvoi a toute la room de
   * l'avancement d'un joueur (picks par role, pas encore soumis). Un
   * spectateur qui commence a regarder en cours de draft ratera juste les
   * picks deja faits jusqu'au prochain changement.
   */
  @SubscribeMessage(DRAFT_EVENTS.DRAFT_PROGRESS)
  handleDraftProgress(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: { picks: Record<string, string>; strategySelections?: StrategySelections },
  ) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room || !this.draftService.isTournament(room.code)) return;
    const matchup = this.draftService.getRoundMatchup(room.code, client.id);
    if (!matchup) return;
    this.server.to(room.code).emit(DRAFT_EVENTS.MATCH_DRAFT_PROGRESS, {
      round: matchup.round,
      matchIndex: matchup.matchIndex,
      playerId: client.id,
      picks: dto.picks ?? {},
      strategySelections: dto.strategySelections ?? {},
    });
  }

  /**
   * Resync a la demande : un client qui suspecte d'avoir rate un broadcast
   * (reconnexion, onglet remis au premier plan...) peut redemander son etat
   * plutot que de rester bloque. Redonne exactement ce qu'il aurait recu en
   * broadcast normal : le bracket complet + son matchup du round courant s'il
   * en a un.
   */
  @SubscribeMessage(DRAFT_EVENTS.REQUEST_STATE)
  handleRequestState(@ConnectedSocket() client: Socket) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room || !this.draftService.isTournament(room.code)) return;
    const progress = this.draftService.getBracketProgress(room.code);
    if (progress) client.emit(DRAFT_EVENTS.BRACKET_STATE, progress);
    const matchup = this.draftService.getRoundMatchup(room.code, client.id);
    if (matchup) client.emit(DRAFT_EVENTS.ROUND_MATCHUP, matchup);
  }

  private handleTournamentSubmit(roomCode: string) {
    const { resolvedMatches, roundJustCompleted, tournamentFinished } =
      this.draftService.tryResolveRound(roomCode);

    const connectedIds = new Set(
      (this.roomsService.getRoom(roomCode)?.players ?? []).map((p) => p.id),
    );
    for (const match of resolvedMatches) {
      const key = `${match.round}-${match.matchIndex}`;
      const duelists = match.isCloneMatch ? [match.playerAId] : [match.playerAId, match.playerBId];
      // On n'attend le MATCH_SEEN que des duellistes encore connectes : un
      // joueur parti (forfait) ne le signalera jamais (sinon 20s de timeout).
      const requiredIds = duelists.filter((id) => connectedIds.has(id));
      if (requiredIds.length) this.armReveal(roomCode, key, requiredIds);
      this.server.to(roomCode).emit(DRAFT_EVENTS.MATCH_RESOLVED, match);
      // Duel entierement deserte : personne n'enverra MATCH_SEEN, reveal immediat.
      if (!requiredIds.length) this.revealMatch(roomCode, key);
    }
    if (resolvedMatches.length) this.broadcastBracketState(roomCode);

    if (!roundJustCompleted) return;

    if (tournamentFinished) {
      const summary = this.draftService.finalizeTournament(roomCode);
      if (!summary) return;
      this.broadcastBracketState(roomCode, summary.progress);
      const room = this.roomsService.getRoom(roomCode);
      const championPseudo = room?.players.find((p) => p.id === summary.championId)?.pseudo ?? 'Un joueur';
      this.finishRound(roomCode, {
        gameId: GAME_ID,
        scores: summary.scores,
        summary: `${championPseudo} remporte le tournoi (${summary.progress.rounds.length} tours).`,
      });
      return;
    }

    this.broadcastBracketState(roomCode);
    this.sendRoundMatchups(roomCode);
  }

  /** Enregistre le resultat de round une seule fois (fin de manche simple OU fin de tournoi), sauf en Party Mix ou le front gere lui-meme l'attente. */
  private finishRound(roomCode: string, base: { gameId: string; scores: Record<string, number>; summary: string }) {
    const room = this.roomsService.getRoom(roomCode);
    if (!room) return;
    if (room.activeMix?.status === 'running') {
      // En Party Mix, on laisse le client afficher la cinematique Draft VS.
      // Chaque joueur signale ensuite `party:segment-complete` quand il a vu le resultat.
      return;
    }
    const roundResult = {
      ...base,
      roundNumber: room.roundHistory.length + 1,
      finishedAt: new Date().toISOString(),
    };
    const updatedRoom = this.roomsService.recordRoundResult(roomCode, roundResult);
    if (!updatedRoom) return;
    this.server
      .to(roomCode)
      .emit(ROOM_EVENTS.ROUND_FINISHED, updatedRoom.roundHistory[updatedRoom.roundHistory.length - 1]);
    this.server.to(roomCode).emit(ROOM_EVENTS.STATE, updatedRoom);
  }

  private broadcastBracketState(roomCode: string, progress = this.draftService.getBracketProgress(roomCode)) {
    if (!progress) return;
    this.server.to(roomCode).emit(DRAFT_EVENTS.BRACKET_STATE, progress);
  }

  private sendRoundMatchups(roomCode: string) {
    for (const { playerId, matchup } of this.draftService.getAllRoundMatchups(roomCode)) {
      this.server.to(playerId).emit(DRAFT_EVENTS.ROUND_MATCHUP, matchup);
    }
  }
}
