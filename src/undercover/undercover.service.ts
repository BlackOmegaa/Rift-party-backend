import { Injectable } from '@nestjs/common';
import { UNDERCOVER_PAIRS } from './data/undercover-pairs.data';
import {
  UndercoverPhase,
  UndercoverPlayerRef,
  UndercoverResult,
  UndercoverSnapshot,
  UndercoverTurnEntry,
  UndercoverTurnInfo,
  UndercoverVoteProgress,
} from './interfaces/undercover.interface';

/** Duree par defaut si aucun reglage de room n'est fourni (ne devrait plus arriver, room.settings.roundTimeSec a toujours une valeur). */
const DEFAULT_TURN_DURATION_MS = 30_000;

interface UndercoverSession {
  roomCode: string;
  normalWord: string;
  undercoverWord: string;
  undercoverId: string;
  turnOrder: UndercoverPlayerRef[];
  phase: UndercoverPhase;
  readyPlayerIds: Set<string>;
  turnIndex: number;
  currentDeadline?: number;
  words: UndercoverTurnEntry[];
  votes: Map<string, string>;
  turnTimeout?: NodeJS.Timeout;
  /** Duree d'un tour en ms, pilotee par room.settings.roundTimeSec. */
  turnDurationMs: number;
}

/**
 * Etat Undercover Champion en memoire, par room. Une session vit le temps
 * d'une manche (reveal -> tour 1 -> tour 2 -> vote -> resultats) puis est
 * nettoyee dans computeResults() (le resultat est conserve a part dans
 * `lastResults` pour un client qui se (re)connecterait apres coup).
 */
@Injectable()
export class UndercoverService {
  private sessions = new Map<string, UndercoverSession>();
  private lastResults = new Map<string, UndercoverResult>();

  startSession(
    roomCode: string,
    players: UndercoverPlayerRef[],
    turnDurationSec: number = DEFAULT_TURN_DURATION_MS / 1000,
  ): { turnOrder: UndercoverPlayerRef[]; turnDurationMs: number } {
    const pair =
      UNDERCOVER_PAIRS[Math.floor(Math.random() * UNDERCOVER_PAIRS.length)];
    const turnOrder = [...players].sort(() => Math.random() - 0.5);
    const undercoverId =
      turnOrder[Math.floor(Math.random() * turnOrder.length)].id;
    const turnDurationMs = turnDurationSec * 1000;

    this.lastResults.delete(roomCode);
    this.sessions.set(roomCode, {
      roomCode,
      normalWord: pair.normal,
      undercoverWord: pair.undercover,
      undercoverId,
      turnOrder,
      phase: 'reveal',
      readyPlayerIds: new Set(),
      turnIndex: 0,
      words: [],
      votes: new Map(),
      turnDurationMs,
    });

    return { turnOrder, turnDurationMs };
  }

  /**
   * Photo instantanee de l'etat courant pour un joueur. Demandee explicitement
   * par le client des qu'il est monte : contrairement aux broadcasts one-shot
   * (START/REVEAL...), une requete ne peut jamais etre "manquee" puisqu'elle
   * part apres que les listeners du client soient deja attaches.
   */
  getSnapshot(roomCode: string, playerId: string): UndercoverSnapshot {
    const session = this.sessions.get(roomCode);
    if (!session) {
      const results = this.lastResults.get(roomCode) ?? null;
      return {
        active: false,
        turnOrder: [],
        turnDurationMs: DEFAULT_TURN_DURATION_MS,
        phase: 'results',
        myWord: null,
        myRevealReady: false,
        words: results?.words ?? [],
        activeTurn: null,
        revealProgress: { ready: 0, total: 0 },
        myVote: null,
        voteProgress: { ready: 0, total: 0, votes: {} },
        results,
      };
    }

    let activeTurn: UndercoverTurnInfo | null = null;
    if (
      (session.phase === 'turn1' || session.phase === 'turn2') &&
      session.currentDeadline
    ) {
      const player = session.turnOrder[session.turnIndex];
      if (player) {
        activeTurn = {
          playerId: player.id,
          round: session.phase === 'turn1' ? 1 : 2,
          deadline: session.currentDeadline,
        };
      }
    }

    return {
      active: true,
      turnOrder: session.turnOrder,
      turnDurationMs: session.turnDurationMs,
      phase: session.phase,
      myWord: this.getPrivateWord(roomCode, playerId) ?? null,
      myRevealReady: session.readyPlayerIds.has(playerId),
      words: session.words,
      activeTurn,
      revealProgress: this.revealProgress(roomCode),
      myVote: session.votes.get(playerId) ?? null,
      voteProgress: this.getVoteProgress(roomCode),
      results: null,
    };
  }

  getPrivateWord(roomCode: string, playerId: string): string | undefined {
    const session = this.sessions.get(roomCode);
    if (!session) return undefined;
    return playerId === session.undercoverId
      ? session.undercoverWord
      : session.normalWord;
  }

  /**
   * Marque un joueur pret apres le reveal. Renvoie true quand tout le monde
   * l'est. Un joueur qui a rejoint la room apres le lancement de la manche
   * n'est jamais dans `turnOrder` : on l'ignore plutot que de fausser le
   * quorum des joueurs reellement en jeu.
   */
  markReady(roomCode: string, playerId: string): boolean {
    const session = this.sessions.get(roomCode);
    if (!session || session.phase !== 'reveal') return false;
    if (!session.turnOrder.some((p) => p.id === playerId)) return false;
    session.readyPlayerIds.add(playerId);
    return session.readyPlayerIds.size >= session.turnOrder.length;
  }

  revealProgress(roomCode: string): { ready: number; total: number } {
    const session = this.sessions.get(roomCode);
    return {
      ready: session?.readyPlayerIds.size ?? 0,
      total: session?.turnOrder.length ?? 0,
    };
  }

  beginTurns(
    roomCode: string,
    onTimeout: (roomCode: string) => void,
  ): UndercoverTurnInfo | undefined {
    const session = this.sessions.get(roomCode);
    if (!session) return undefined;
    session.phase = 'turn1';
    session.turnIndex = 0;
    return this.scheduleCurrentTurn(session, onTimeout);
  }

  nextTurn(
    roomCode: string,
    onTimeout: (roomCode: string) => void,
  ): UndercoverTurnInfo | undefined {
    const session = this.sessions.get(roomCode);
    if (!session || (session.phase !== 'turn1' && session.phase !== 'turn2')) {
      return undefined;
    }
    return this.scheduleCurrentTurn(session, onTimeout);
  }

  phaseOf(roomCode: string): UndercoverPhase | undefined {
    return this.sessions.get(roomCode)?.phase;
  }

  submitWord(
    roomCode: string,
    playerId: string,
    word: string,
  ): { entry: UndercoverTurnEntry; phaseComplete: boolean } {
    const session = this.sessions.get(roomCode);
    if (!session || (session.phase !== 'turn1' && session.phase !== 'turn2')) {
      throw new Error("Ce n'est pas la phase d'ecriture des mots.");
    }
    const player = session.turnOrder[session.turnIndex];
    if (!player || player.id !== playerId) {
      throw new Error("Ce n'est pas ton tour.");
    }
    const trimmed = word.trim();
    if (!trimmed) throw new Error('Le mot ne peut pas etre vide.');

    const round: 1 | 2 = session.phase === 'turn1' ? 1 : 2;
    if (round === 2) {
      const previous = session.words.find(
        (w) => w.playerId === playerId && w.round === 1,
      );
      if (previous && previous.word.trim().toLowerCase() === trimmed.toLowerCase()) {
        throw new Error('Tu dois proposer un mot different de ton premier tour.');
      }
    }

    return this.recordTurn(session, player, trimmed, round, false);
  }

  /** Appele par le timer serveur si un joueur ne repond pas a temps. */
  autoAdvanceOnTimeout(roomCode: string): UndercoverTurnEntry | undefined {
    const session = this.sessions.get(roomCode);
    if (!session || (session.phase !== 'turn1' && session.phase !== 'turn2')) {
      return undefined;
    }
    const player = session.turnOrder[session.turnIndex];
    if (!player) return undefined;
    const round: 1 | 2 = session.phase === 'turn1' ? 1 : 2;
    return this.recordTurn(session, player, '', round, true).entry;
  }

  private recordTurn(
    session: UndercoverSession,
    player: UndercoverPlayerRef,
    word: string,
    round: 1 | 2,
    timedOut: boolean,
  ): { entry: UndercoverTurnEntry; phaseComplete: boolean } {
    if (session.turnTimeout) {
      clearTimeout(session.turnTimeout);
      session.turnTimeout = undefined;
    }
    const entry: UndercoverTurnEntry = {
      playerId: player.id,
      pseudo: player.pseudo,
      word,
      round,
      timedOut,
    };
    session.words.push(entry);
    session.turnIndex += 1;

    const phaseComplete = session.turnIndex >= session.turnOrder.length;
    if (phaseComplete) {
      if (session.phase === 'turn1') {
        session.phase = 'turn2';
        session.turnIndex = 0;
      } else {
        session.phase = 'vote';
      }
    }
    return { entry, phaseComplete };
  }

  private scheduleCurrentTurn(
    session: UndercoverSession,
    onTimeout: (roomCode: string) => void,
  ): UndercoverTurnInfo | undefined {
    const player = session.turnOrder[session.turnIndex];
    if (!player) return undefined;
    const round: 1 | 2 = session.phase === 'turn1' ? 1 : 2;
    const deadline = Date.now() + session.turnDurationMs;
    session.currentDeadline = deadline;
    session.turnTimeout = setTimeout(
      () => onTimeout(session.roomCode),
      session.turnDurationMs,
    );
    return { playerId: player.id, round, deadline };
  }

  submitVote(
    roomCode: string,
    voterId: string,
    targetId: string,
    connectedPlayerIds: string[],
  ): boolean {
    const session = this.sessions.get(roomCode);
    if (!session || session.phase !== 'vote') {
      throw new Error("Le vote n'est pas encore ouvert.");
    }
    if (voterId === targetId) throw new Error('Tu ne peux pas voter pour toi-meme.');
    if (session.votes.has(voterId)) throw new Error('Tu as deja vote.');
    if (!session.turnOrder.some((p) => p.id === targetId)) {
      throw new Error('Cible de vote invalide.');
    }

    session.votes.set(voterId, targetId);
    return this.isVoteComplete(roomCode, connectedPlayerIds);
  }

  /**
   * Revote si le dernier votant attendu vient de quitter la room : sans ca,
   * le vote resterait bloque indefiniment puisque `submitVote` est le seul
   * endroit qui recalculait ce total (voir UndercoverGateway sur
   * `room.player-left`).
   */
  isVoteComplete(roomCode: string, connectedPlayerIds: string[]): boolean {
    const session = this.sessions.get(roomCode);
    if (!session || session.phase !== 'vote') return false;
    const expectedVoters = connectedPlayerIds.filter((id) =>
      session.turnOrder.some((p) => p.id === id),
    );
    return (
      expectedVoters.length > 0 &&
      expectedVoters.every((id) => session.votes.has(id))
    );
  }

  /** Votes publics en temps reel : chaque joueur voit qui vote pour qui des que le vote est pose. */
  getVoteProgress(roomCode: string): UndercoverVoteProgress {
    const session = this.sessions.get(roomCode);
    return {
      ready: session?.votes.size ?? 0,
      total: session?.turnOrder.length ?? 0,
      votes: session ? Object.fromEntries(session.votes) : {},
    };
  }

  computeResults(roomCode: string): UndercoverResult {
    const session = this.sessions.get(roomCode);
    if (!session) throw new Error('Aucune manche Undercover en cours dans cette room.');

    const tally = new Map<string, number>();
    for (const targetId of session.votes.values()) {
      tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
    }
    const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
    const topCount = sorted[0]?.[1] ?? 0;
    const topPlayers = sorted.filter(([, count]) => count === topCount);
    const found = topPlayers.length === 1 && topPlayers[0][0] === session.undercoverId;

    const scores: Record<string, number> = {};
    for (const player of session.turnOrder) {
      if (player.id === session.undercoverId) {
        scores[player.id] = found ? 0 : 15;
        continue;
      }
      const votedCorrectly = session.votes.get(player.id) === session.undercoverId;
      scores[player.id] = found && votedCorrectly ? 10 : 0;
    }

    const undercoverPseudo =
      session.turnOrder.find((p) => p.id === session.undercoverId)?.pseudo ??
      'Un joueur';
    const summary = found
      ? `${undercoverPseudo} etait l'Undercover et a ete demasque.`
      : `${undercoverPseudo} etait l'Undercover et s'en sort sans etre demasque.`;

    const result: UndercoverResult = {
      undercoverId: session.undercoverId,
      undercoverPseudo,
      normalWord: session.normalWord,
      undercoverWord: session.undercoverWord,
      found,
      votes: Object.fromEntries(session.votes),
      words: session.words,
      scores,
      summary,
    };

    this.lastResults.set(roomCode, result);
    this.sessions.delete(roomCode);
    return result;
  }
}
