export type BrumeRole = 'warwick' | 'fiddlesticks' | 'thresh' | 'ashe' | 'poro' | 'kindred';
export type BrumeTeam = 'predators' | 'circle' | 'solo';
export type BrumePhase = 'reveal' | 'night' | 'day' | 'vote' | 'results';

export interface BrumePlayerRef {
  id: string;
  pseudo: string;
}

/**
 * Chaque role est un champion precis avec une mecanique tiree de son vrai
 * kit (pas un simple reskin de "loup" / "voyante"). Voir brume.service.ts
 * pour le detail des resolutions de nuit.
 */
export const BRUME_ROLE_META: Record<
  BrumeRole,
  { label: string; team: BrumeTeam; champion: string; kit: string }
> = {
  warwick: {
    label: 'Warwick',
    team: 'predators',
    champion: 'Warwick',
    kit: "Chaque nuit : Morsure (elimine la cible ; a l'aube, une odeur de sang trompeuse pointe vers un survivant au hasard, PAS la vraie victime, pour brouiller les pistes) ou Effroi (fait taire la cible le jour suivant).",
  },
  fiddlesticks: {
    label: 'Fiddlesticks',
    team: 'predators',
    champion: 'Fiddlesticks',
    kit: "Repere une cible en silence ; si elle survit non protegee, Crowstorm la frappe a l'aube suivante.",
  },
  thresh: {
    label: 'Thresh',
    team: 'circle',
    champion: 'Thresh',
    kit: 'Chaque nuit, protege un joueur avec sa Lanterne : la cible survit a toute elimination cette nuit-la.',
  },
  ashe: {
    label: 'Ashe',
    team: 'circle',
    champion: 'Ashe',
    kit: "Chaque nuit, scoute un joueur avec Hawkshot : indice fiable a 100% (Ombre / Clarte).",
  },
  poro: {
    label: 'Poro',
    team: 'circle',
    champion: 'Poro',
    kit: "Chaque nuit, participe au Blottissement collectif du Cercle : avec les autres Poros, vote pour un joueur a surveiller. A l'aube, le groupe apprend si un danger rodait vraiment pres de la cible du vote majoritaire (mais pas qui l'a tue ni pourquoi).",
  },
  kindred: {
    label: 'Kindred',
    team: 'solo',
    champion: 'Kindred',
    kit: "Marque une cible en secret. Deux nuits de chasse ininterrompue suffisent a gagner seul, peu importe le camp vainqueur.",
  },
};

export type BrumeNightActionType =
  | 'consommer'
  | 'effroi'
  | 'mark_fiddlesticks'
  | 'protect'
  | 'scout'
  | 'huddle'
  | 'mark_kindred'
  | 'hunt';

export interface BrumeNightActionPayload {
  action: BrumeNightActionType;
  targetId?: string;
}

export type BrumeDeathCause = 'consommer' | 'fiddlesticks' | 'kindred' | 'vote';

export interface BrumeDeathRecord {
  playerId: string;
  pseudo: string;
  cause: BrumeDeathCause;
}

export interface BrumeNightRecap {
  day: number;
  deaths: BrumeDeathRecord[];
  bloodTracePseudo: string | null;
  silencedPseudos: string[];
  poroWatch: { targetPseudo: string; dangerDetected: boolean } | null;
}

export type BrumeChatChannel = 'pack' | 'assembly';
export type BrumeChatKind = 'text' | 'vote' | 'system' | 'reaction';

export interface BrumeChatMessage {
  id: string;
  channel: BrumeChatChannel;
  kind: BrumeChatKind;
  playerId: string | null;
  pseudo: string | null;
  text: string;
  createdAt: number;
}

export interface BrumeVoteProgress {
  ready: number;
  total: number;
  votes: Record<string, string>; // voterId -> targetId
}

export interface BrumeResult {
  winner: 'predators' | 'circle' | 'kindred';
  summary: string;
  roles: Record<
    string,
    { role: BrumeRole; team: BrumeTeam; pseudo: string; alive: boolean }
  >;
  history: BrumeNightRecap[];
  scores: Record<string, number>;
}

export interface BrumeAsheClue {
  targetId: string;
  targetPseudo: string;
  result: 'ombre' | 'clarte';
}

/** Coequipier d'equipe "predateurs" (les mechants) : revele son role precis, pas juste son pseudo, pour coordonner la nuit (voir demande produit : indicateur visuel des mechants entre eux). */
export interface BrumeTeammateRef {
  id: string;
  pseudo: string;
  role: BrumeRole;
}

/**
 * Photo instantanee de l'etat d'une manche pour un joueur donne. Meme
 * convention que UndercoverSnapshot : demandee explicitement par le client
 * au montage, jamais manquee contrairement aux broadcasts one-shot.
 */
export interface BrumeSnapshot {
  active: boolean;
  phase: BrumePhase;
  dayNumber: number;
  players: BrumePlayerRef[];
  alivePlayerIds: string[];
  myRole: BrumeRole | null;
  myTeam: BrumeTeam | null;
  myChampion: string | null;
  myKit: string | null;
  /** Uniquement pour l'equipe "predateurs" (les mechants) : qui sont les autres, avec leur role precis. Vide pour tout le monde d'autre (circle/solo). */
  myTeammates: BrumeTeammateRef[];
  myRevealReady: boolean;
  revealProgress: { ready: number; total: number };
  phaseDeadline: number | null;
  phaseDurationMs: number;
  myNightActionSubmitted: boolean;
  myFiddlesticksPending: boolean;
  myKindredMarqueId: string | null;
  myKindredHuntStreak: number;
  myAsheClue: BrumeAsheClue | null;
  lastDawn: BrumeNightRecap | null;
  packChat: BrumeChatMessage[];
  dayChat: BrumeChatMessage[];
  myVote: string | null;
  voteProgress: BrumeVoteProgress;
  results: BrumeResult | null;
}
