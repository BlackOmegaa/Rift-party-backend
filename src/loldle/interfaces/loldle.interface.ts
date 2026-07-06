export type LoldleLetterState = 'correct' | 'present' | 'absent';

export interface LoldlePlayerRef {
  id: string;
  pseudo: string;
}

export interface LoldleGuessRow {
  name: string;
  feedback: LoldleLetterState[];
}

/** Evenement public diffuse a chaque essai : jamais les lettres ni le mot tente, juste le fait qu'il y a eu tentative. */
export interface LoldleFeedEntry {
  playerId: string;
  pseudo: string;
  attemptNumber: number;
  solved: boolean;
}

export interface LoldleResultRow {
  playerId: string;
  pseudo: string;
  solved: boolean;
  attempts: number;
  points: number;
}

export interface LoldleResult {
  secretName: string;
  rows: LoldleResultRow[];
  scores: Record<string, number>;
  summary: string;
}

/**
 * Photo instantanee de l'etat d'une manche pour un joueur donne. Meme
 * convention que BrumeSnapshot/UndercoverSnapshot : demandee explicitement
 * par le client au montage, jamais manquee contrairement aux broadcasts
 * one-shot.
 */
export interface LoldleSnapshot {
  active: boolean;
  phase: 'guessing' | 'results';
  wordLength: number;
  maxGuesses: number;
  phaseDeadline: number | null;
  phaseDurationMs: number;
  myRows: LoldleGuessRow[];
  myDone: boolean;
  mySolved: boolean;
  feed: LoldleFeedEntry[];
  results: LoldleResult | null;
}
