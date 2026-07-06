export type Role = 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT';

export type ChampionTag =
  | 'tank'
  | 'mage'
  | 'assassin'
  | 'marksman'
  | 'support'
  | 'fighter'
  | 'engage'
  | 'disengage'
  | 'poke'
  | 'burst'
  | 'sustain'
  | 'mobility'
  | 'scaling-early'
  | 'scaling-mid'
  | 'scaling-late'
  | 'ad'
  | 'ap'
  | 'cc-heavy';

export type ChampionRarity = 'gratuit' | 'commun' | 'rare' | 'tres-rare' | 'epique' | 'legendaire' | 'mythique';

export type PlaystyleArchetype = 'dive' | 'poke' | 'teamfight' | 'splitpush';

export interface Champion {
  id: string;
  name: string;
  cost: number;
  roles: Role[];
  tags: ChampionTag[];
  ccScore: number; // 0-3, contribution au controle de foule
  rarity: ChampionRarity;
}

export interface DraftPick {
  playerId: string;
  championIds: string[]; // 5 champions
}

export interface DraftFactorBreakdown {
  key: string;
  label: string;
  points: number;
}

export interface Perk {
  id: string;
  label: string;
  /** Nom d'icone (voir shared IconComponent cote frontend, meme jeu de noms). */
  icon: string;
}

export interface DraftResult {
  playerId: string;
  totalScore: number;
  championIds: string[];
  factors: DraftFactorBreakdown[];
  isWinner: boolean;
  /** Scenario de match (voir MatchScenarioEngine), attache seulement pour les 2 meilleurs joueurs en mode non-tournoi. */
  scenario?: MatchScenario;
  /** Quel cote (A/B) du `scenario` correspond a ce joueur. */
  scenarioSide?: ScenarioSide;
  /** Badges de variete (0-2), voir perks.engine.ts : recompensent une identite de comp marquee, pas juste le score brut. */
  perks: Perk[];
}

export interface SynergyRule {
  championIds: [string, string];
  points: number;
  label: string;
}

export type StrategyCategoryId = 'playstyle' | 'macro' | 'itemization';

export interface StrategyOption {
  id: string;
  label: string;
  description: string;
}

export interface StrategyCategory {
  id: StrategyCategoryId;
  label: string;
  prompt: string;
  options: StrategyOption[];
}

/** categoryId -> optionId choisi par le joueur */
export type StrategySelections = Partial<Record<StrategyCategoryId, string>>;

export type DraftEvent = 'budget-illimite' | 'legendaire-only' | 'mythique-only';

export type DraftMatchStatus = 'drafting' | 'resolved';

/**
 * Un match du bracket, round par round. `playerAId` est toujours un vrai
 * joueur. `playerBId` est soit un vrai joueur, soit un id synthetique de
 * "clone" (voir CLONE_PREFIX dans tournament.engine.ts) quand `isCloneMatch`
 * est vrai : le nombre de joueurs est impair, un joueur tombe seul dans son
 * tour et affronte une copie de la draft d'un autre joueur (pris au hasard
 * parmi les autres joueurs de ce round), plutot qu'un bye gratuit. Si le
 * clone gagne, `winnerId` vaut son id synthetique (le joueur seul est
 * simplement elimine) ; ca n'affecte jamais le vrai match du joueur clone.
 *
 * `budget`/`event` sont tires INDEPENDAMMENT pour CHAQUE match (voir demande
 * produit : un event special doit pouvoir tomber sur un duel precis d'un
 * round sans affecter les autres duels du meme round, ni les rounds suivants
 * pour les memes joueurs). Le match clone reprend toujours le budget/event du
 * match reel de son `clonedFromPlayerId` (meme round), puisqu'il rejoue la
 * meme soumission plutot que d'en tirer une nouvelle.
 */
export interface DraftMatchState {
  round: number;
  matchIndex: number;
  playerAId: string;
  playerBId: string;
  isCloneMatch: boolean;
  clonedFromPlayerId?: string;
  status: DraftMatchStatus;
  winnerId?: string;
  scenario?: MatchScenario;
  budget: number;
  event: DraftEvent | null;
}

export interface TournamentRoundState {
  round: number;
  matches: DraftMatchState[];
}

/** Etat complet du bracket, rediffuse a chaque changement (soumission, match resolu, round termine). */
export interface TournamentProgress {
  rounds: TournamentRoundState[];
  currentRound: number;
  championId?: string;
}

/** Emit prive par joueur : contre qui il joue ce round, avec le budget/event de CE match precis (voir DraftMatchState). */
export interface RoundMatchup {
  round: number;
  matchIndex: number;
  opponentId: string;
  isCloneMatch: boolean;
  clonedFromPlayerId?: string;
  budget: number;
  event: DraftEvent | null;
}

export type ScenarioPhaseKind = 'lane' | 'skirmish' | 'objective' | 'teamfight' | 'macro';
export type ScenarioSide = 'A' | 'B';
export type ScenarioTagScope = 'fed' | 'objective' | 'pick';

export interface ScenarioPhase {
  minute: number;
  label: string;
  kind: ScenarioPhaseKind;
  text: string;
  favors: ScenarioSide;
  /** Champion "heros" de la phase (cote favors). Toujours renseigne. */
  championId: string;
  /** Uniquement pour les phases de type "lane" : le champion du cote perdant du duel. */
  opponentChampionId?: string;
}

/**
 * Scenario de match genere par MatchScenarioEngine : deterministe (voir son
 * `seed`), donc identique pour les deux joueurs et tout spectateur qui
 * regarderait le meme match. `winnerSide` reprend toujours le vainqueur deja
 * decide par DraftScoringEngine, jamais recalcule ici.
 */
export interface MatchScenario {
  seed: string;
  phases: ScenarioPhase[];
  winnerSide: ScenarioSide;
  closingLine: string;
}
