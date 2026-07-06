import { Injectable } from '@nestjs/common';
import { LOLDLE_CHAMPIONS, LOLDLE_SECRET_POOL } from './data/loldle-champions.data';
import {
  LoldleFeedEntry,
  LoldleGuessRow,
  LoldleLetterState,
  LoldlePlayerRef,
  LoldleResult,
  LoldleSnapshot,
} from './interfaces/loldle.interface';

const MAX_GUESSES = 6;
const ROUND_DURATION_MS = 120_000;

interface LoldlePlayerState {
  rows: LoldleGuessRow[];
  solved: boolean;
  done: boolean;
}

interface LoldleSession {
  roomCode: string;
  players: LoldlePlayerRef[];
  secretName: string;
  secretNormalized: string;
  phase: 'guessing' | 'results';
  phaseDeadline: number;
  phaseTimeout?: NodeJS.Timeout;
  playerStates: Map<string, LoldlePlayerState>;
  feed: LoldleFeedEntry[];
}

/** Algorithme Wordle classique en deux passes : gere correctement les lettres dupliquees. */
function computeFeedback(secret: string, guess: string): LoldleLetterState[] {
  const n = secret.length;
  const result: LoldleLetterState[] = new Array(n).fill('absent');
  const used = new Array(n).fill(false);

  for (let i = 0; i < n; i++) {
    if (guess[i] === secret[i]) {
      result[i] = 'correct';
      used[i] = true;
    }
  }
  for (let i = 0; i < n; i++) {
    if (result[i] === 'correct') continue;
    const idx = secret.split('').findIndex((c, j) => c === guess[i] && !used[j]);
    if (idx !== -1) {
      result[i] = 'present';
      used[idx] = true;
    }
  }
  return result;
}

/**
 * Etat "Loldle" en memoire, par room. Meme convention que BrumeService /
 * UndercoverService : une session vit le temps d'une manche puis est
 * nettoyee dans computeResults() (le resultat est conserve a part dans
 * `lastResults` pour un client qui se (re)connecterait apres coup).
 */
@Injectable()
export class LoldleService {
  private sessions = new Map<string, LoldleSession>();
  private lastResults = new Map<string, LoldleResult>();

  startSession(
    roomCode: string,
    players: LoldlePlayerRef[],
    onTimeout: (roomCode: string) => void,
    wordLength?: number | null,
  ): { wordLength: number; maxGuesses: number; deadline: number; durationMs: number } {
    const filtered = wordLength
      ? LOLDLE_SECRET_POOL.filter((c) => c.normalized.length === wordLength)
      : LOLDLE_SECRET_POOL;
    const pool = filtered.length ? filtered : LOLDLE_SECRET_POOL;
    const secret = pool[Math.floor(Math.random() * pool.length)];
    const deadline = Date.now() + ROUND_DURATION_MS;

    this.lastResults.delete(roomCode);
    const playerStates = new Map<string, LoldlePlayerState>();
    for (const p of players) playerStates.set(p.id, { rows: [], solved: false, done: false });

    const session: LoldleSession = {
      roomCode,
      players,
      secretName: secret.name,
      secretNormalized: secret.normalized,
      phase: 'guessing',
      phaseDeadline: deadline,
      playerStates,
      feed: [],
    };
    session.phaseTimeout = setTimeout(() => onTimeout(roomCode), ROUND_DURATION_MS);
    this.sessions.set(roomCode, session);

    return {
      wordLength: secret.normalized.length,
      maxGuesses: MAX_GUESSES,
      deadline,
      durationMs: ROUND_DURATION_MS,
    };
  }

  phaseOf(roomCode: string): 'guessing' | 'results' | undefined {
    return this.sessions.get(roomCode)?.phase;
  }

  /** Valide + enregistre un essai. Renvoie la ligne de feedback (prive) et l'entree de feed (publique). */
  submitGuess(
    roomCode: string,
    playerId: string,
    rawName: string,
  ): { row: LoldleGuessRow; feedEntry: LoldleFeedEntry; allDone: boolean } {
    const session = this.sessions.get(roomCode);
    if (!session || session.phase !== 'guessing') {
      throw new Error("Ce n'est pas la phase de devinette.");
    }
    const state = session.playerStates.get(playerId);
    if (!state) throw new Error("Tu ne fais pas partie de cette manche.");
    if (state.done) throw new Error('Tu as deja termine ta grille.');

    const champion = LOLDLE_CHAMPIONS.find(
      (c) => c.name.toLowerCase() === rawName.trim().toLowerCase(),
    );
    if (!champion) throw new Error('Champion inconnu.');
    if (champion.normalized.length !== session.secretNormalized.length) {
      throw new Error(`Ce champion ne fait pas ${session.secretNormalized.length} lettres.`);
    }

    const feedback = computeFeedback(session.secretNormalized, champion.normalized);
    const row: LoldleGuessRow = { name: champion.name, feedback };
    state.rows.push(row);

    const solved = champion.normalized === session.secretNormalized;
    if (solved) state.solved = true;
    if (solved || state.rows.length >= MAX_GUESSES) state.done = true;

    const player = session.players.find((p) => p.id === playerId);
    const feedEntry: LoldleFeedEntry = {
      playerId,
      pseudo: player?.pseudo ?? 'Joueur',
      attemptNumber: state.rows.length,
      solved,
    };
    session.feed.push(feedEntry);

    const allDone = [...session.playerStates.values()].every((s) => s.done);
    return { row, feedEntry, allDone };
  }

  getSnapshot(roomCode: string, playerId: string): LoldleSnapshot {
    const session = this.sessions.get(roomCode);
    if (!session) {
      const results = this.lastResults.get(roomCode) ?? null;
      return {
        active: false,
        phase: 'results',
        wordLength: 0,
        maxGuesses: MAX_GUESSES,
        phaseDeadline: null,
        phaseDurationMs: ROUND_DURATION_MS,
        myRows: [],
        myDone: false,
        mySolved: false,
        feed: [],
        results,
      };
    }

    const state = session.playerStates.get(playerId);
    return {
      active: true,
      phase: session.phase,
      wordLength: session.secretNormalized.length,
      maxGuesses: MAX_GUESSES,
      phaseDeadline: session.phaseDeadline,
      phaseDurationMs: ROUND_DURATION_MS,
      myRows: state?.rows ?? [],
      myDone: state?.done ?? false,
      mySolved: state?.solved ?? false,
      feed: session.feed,
      results: null,
    };
  }

  computeResults(roomCode: string): LoldleResult {
    const session = this.sessions.get(roomCode);
    if (!session) throw new Error('Aucune manche Loldle en cours dans cette room.');
    if (session.phaseTimeout) clearTimeout(session.phaseTimeout);
    session.phase = 'results';

    const rows = session.players.map((p) => {
      const state = session.playerStates.get(p.id)!;
      const attempts = state.rows.length;
      const points = state.solved ? (MAX_GUESSES - attempts + 1) * 15 : 5;
      return { playerId: p.id, pseudo: p.pseudo, solved: state.solved, attempts, points };
    });

    const scores: Record<string, number> = {};
    for (const row of rows) scores[row.playerId] = row.points;

    const solvedRows = rows.filter((r) => r.solved).sort((a, b) => a.attempts - b.attempts);
    const summary = solvedRows.length
      ? `${solvedRows[0].pseudo} trouve ${session.secretName} en ${solvedRows[0].attempts} essai${solvedRows[0].attempts > 1 ? 's' : ''}.`
      : `Personne n'a trouve ${session.secretName}.`;

    const result: LoldleResult = { secretName: session.secretName, rows, scores, summary };
    this.lastResults.set(roomCode, result);
    this.sessions.delete(roomCode);
    return result;
  }

  getPlayers(roomCode: string): LoldlePlayerRef[] {
    return this.sessions.get(roomCode)?.players ?? [];
  }
}
