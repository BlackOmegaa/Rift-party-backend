export interface UndercoverPair {
  normal: string;
  undercover: string;
}

export type UndercoverPhase = 'reveal' | 'turn1' | 'turn2' | 'vote' | 'results';

export interface UndercoverTurnEntry {
  playerId: string;
  pseudo: string;
  word: string;
  round: 1 | 2;
  timedOut: boolean;
}

export interface UndercoverResult {
  undercoverId: string;
  undercoverPseudo: string;
  normalWord: string;
  undercoverWord: string;
  found: boolean;
  votes: Record<string, string>; // voterId -> targetId
  words: UndercoverTurnEntry[];
  scores: Record<string, number>;
  summary: string;
}

export interface UndercoverPlayerRef {
  id: string;
  pseudo: string;
}

export interface UndercoverTurnInfo {
  playerId: string;
  round: 1 | 2;
  deadline: number;
}

/**
 * Etat des votes en cours, diffuse a chaque nouveau vote. Les votes sont
 * publics en temps reel (pas secrets jusqu'aux resultats) : chaque joueur voit
 * qui vote pour qui des que le vote est pose.
 */
export interface UndercoverVoteProgress {
  ready: number;
  total: number;
  votes: Record<string, string>; // voterId -> targetId
}

/**
 * Photo instantanee de l'etat d'une manche pour un joueur donne. Demandee par
 * le client a la connexion (ou reconnexion) au lieu de compter uniquement sur
 * les broadcasts one-shot, qui peuvent arriver avant que le composant/service
 * frontend ne soit monte et donc etre manques.
 */
export interface UndercoverSnapshot {
  active: boolean;
  turnOrder: UndercoverPlayerRef[];
  turnDurationMs: number;
  phase: UndercoverPhase;
  myWord: string | null;
  myRevealReady: boolean;
  words: UndercoverTurnEntry[];
  activeTurn: UndercoverTurnInfo | null;
  revealProgress: { ready: number; total: number };
  myVote: string | null;
  voteProgress: UndercoverVoteProgress;
  results: UndercoverResult | null;
}
