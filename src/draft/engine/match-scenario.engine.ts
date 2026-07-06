import {
  Champion,
  ChampionTag,
  DraftFactorBreakdown,
  MatchScenario,
  PlaystyleArchetype,
  Role,
  ScenarioPhase,
  ScenarioPhaseKind,
  ScenarioSide,
  ScenarioTagScope,
} from '../interfaces/draft.interface';
import { classifyArchetypes, LANE_INTERACTIONS } from '../data/lane-archetypes.data';
import { ICONIC_MATCHUPS } from '../data/iconic-matchups.data';
import { ARCHETYPE_VERBS, SBIRE_LINES, SCENARIO_TEMPLATES, ScenarioTemplate } from '../data/scenario-templates.data';

/** Sbire = champion gratuit (voir champions.data.ts::SBIRE_CHAMPIONS) : ne doit jamais "briller" comme heros d'une phase. */
function isSbire(champion: Champion): boolean {
  return champion.rarity === 'gratuit';
}

function pickSbireLine(kind: ScenarioPhaseKind, rng: () => number): string {
  const lines = SBIRE_LINES[kind];
  return lines[Math.floor(rng() * lines.length)];
}

const ROLES: Role[] = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
const ROLE_LABEL: Record<Role, string> = {
  TOP: 'Toplane',
  JUNGLE: 'Jungle',
  MID: 'Mid',
  ADC: 'Botlane',
  SUPPORT: 'Support',
};
const MINUTE_BANDS: [number, number][] = [
  [3, 6],
  [7, 11],
  [12, 17],
  [18, 23],
  [24, 29],
  [30, 35],
  [36, 42],
];

export interface MatchScenarioTeamInput {
  playerId: string;
  /** Ordonne selon ROLES (TOP,JUNGLE,MID,ADC,SUPPORT) — c'est l'ordre dans lequel les picks sont soumis. */
  champions: Champion[];
  factors: DraftFactorBreakdown[];
  /** Style de jeu detecte (voir detectArchetype), utilise pour choisir un gabarit narratif qui le mentionne explicitement. */
  archetype?: PlaystyleArchetype | null;
}

export interface MatchScenarioInput {
  matchSeed: string;
  teamA: MatchScenarioTeamInput;
  teamB: MatchScenarioTeamInput;
  winnerSide: ScenarioSide;
}

interface ScenarioTag {
  scope: ScenarioTagScope;
  side: ScenarioSide;
}

interface PhaseDraft {
  minute: number;
  label: string;
  kind: ScenarioPhaseKind;
  favors: ScenarioSide;
  confidence: number;
  naturalFavors: ScenarioSide;
  role?: Role;
  champTeamA?: Champion;
  champTeamB?: Champion;
  hint?: string;
  hintStrength?: number;
}

/** Hash string -> seed 32 bits, pour nourrir le PRNG deterministe. */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 : PRNG deterministe pur, jamais Math.random() dans ce moteur. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, min = -1, max = 1): number {
  return Math.max(min, Math.min(max, n));
}

function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '');
}

function countTag(champions: Champion[], tag: ChampionTag): number {
  return champions.filter((c) => c.tags.includes(tag)).length;
}

function factorDiff(input: MatchScenarioInput, key: string): number {
  const a = input.teamA.factors.find((f) => f.key === key)?.points ?? 0;
  const b = input.teamB.factors.find((f) => f.key === key)?.points ?? 0;
  return a - b;
}

function weightedPick<T extends string>(rng: () => number, entries: [T, number][]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [value, weight] of entries) {
    if (roll < weight) return value;
    roll -= weight;
  }
  return entries[entries.length - 1][0];
}

function pickKind(ratio: number, rng: () => number): ScenarioPhaseKind {
  if (ratio < 0.35) {
    return weightedPick(rng, [
      ['lane', 0.5],
      ['skirmish', 0.35],
      ['objective', 0.15],
    ]);
  }
  if (ratio < 0.7) {
    return weightedPick(rng, [
      ['skirmish', 0.3],
      ['objective', 0.4],
      ['lane', 0.15],
      ['teamfight', 0.15],
    ]);
  }
  return weightedPick(rng, [
    ['teamfight', 0.5],
    ['macro', 0.25],
    ['objective', 0.25],
  ]);
}

function biasToSide(diff: number, rng: () => number): ScenarioSide {
  const probA = Math.max(0.15, Math.min(0.85, 0.5 + diff * 0.35));
  return rng() < probA ? 'A' : 'B';
}

/**
 * Determine qui gagne un duel de lane : d'abord un contre-pick emblematique
 * curate (ICONIC_MATCHUPS), sinon une heuristique par archetype de tags
 * (LANE_INTERACTIONS). Pas de matrice exhaustive : le reste retombe sur un
 * duel neutre (strength 0.5).
 */
function laneAdvantage(
  champTeamA: Champion,
  champTeamB: Champion,
): { side: ScenarioSide; hint?: string; strength: number } {
  // Un sbire perd systematiquement sa lane face a un vrai champion (jamais de hint
  // narratif ici : renderPhase bascule sur SBIRE_LINES pour le texte).
  const aSbire = isSbire(champTeamA);
  const bSbire = isSbire(champTeamB);
  if (aSbire !== bSbire) return { side: aSbire ? 'B' : 'A', strength: 0.95 };

  const iconic = ICONIC_MATCHUPS.find(
    (m) =>
      (m.championIdA === champTeamA.id && m.championIdB === champTeamB.id) ||
      (m.championIdA === champTeamB.id && m.championIdB === champTeamA.id),
  );
  if (iconic) {
    const entryFavorsTeamA = (iconic.favors === 'A') === (iconic.championIdA === champTeamA.id);
    return { side: entryFavorsTeamA ? 'A' : 'B', hint: iconic.narrativeHint, strength: iconic.strength };
  }

  const archsA = classifyArchetypes(champTeamA);
  const archsB = classifyArchetypes(champTeamB);
  for (const a of archsA) {
    for (const b of archsB) {
      const inter = LANE_INTERACTIONS.find((i) => i.attacker === a && i.defender === b);
      if (inter) return { side: 'A', hint: inter.narrativeHint, strength: inter.advantage };
    }
  }
  for (const b of archsB) {
    for (const a of archsA) {
      const inter = LANE_INTERACTIONS.find((i) => i.attacker === b && i.defender === a);
      if (inter) return { side: 'B', hint: inter.narrativeHint, strength: inter.advantage };
    }
  }
  return { side: 'A', strength: 0.5 };
}

function objectiveNameFor(minute: number, rng: () => number): string {
  if (minute < 15) return rng() < 0.55 ? 'le Herald' : 'le Dragon';
  if (minute < 24) return 'le Dragon';
  return rng() < 0.5 ? 'le Baron' : 'le Nashor';
}

const PHASE_KIND_PREFERRED_TAGS: Partial<Record<ScenarioPhaseKind, ChampionTag[]>> = {
  skirmish: ['mobility', 'engage', 'assassin'],
  objective: ['engage', 'tank', 'poke'],
  teamfight: ['engage', 'cc-heavy', 'tank'],
  macro: ['scaling-late', 'mobility', 'poke'],
};

/**
 * Choisit le champion "heros" d'une phase d'equipe (skirmish/objective/
 * teamfight/macro), au hasard parmi ceux pertinents pour ce type de phase.
 * Tire a chaque phase (pas une fois pour tout le match) : sans ca, un seul
 * champion (typiquement le jungler engage) monopolise tout le recit au lieu
 * de laisser tourner le projecteur sur le reste de l'equipe.
 */
function pickRepresentativeForPhase(team: Champion[], kind: ScenarioPhaseKind, rng: () => number): Champion {
  // Un sbire ne doit jamais devenir le "heros" d'une phase de groupe (teamfight/
  // objectif/macro/skirmish) : ces recits mettent en scene un impact fort, ce
  // qui n'a aucun sens pour une unite gratuite. On l'exclut du pool tant que
  // l'equipe a au moins un vrai champion disponible.
  const usableTeam = team.some((c) => !isSbire(c)) ? team.filter((c) => !isSbire(c)) : team;
  const tags = PHASE_KIND_PREFERRED_TAGS[kind] ?? [];
  const candidates: Champion[] = [];
  for (const tag of tags) {
    for (const c of usableTeam) {
      if (c.tags.includes(tag) && !candidates.includes(c)) candidates.push(c);
    }
  }
  const pool = candidates.length ? candidates : usableTeam;
  return pool[Math.floor(rng() * pool.length)];
}

function pickTemplate(
  kind: ScenarioPhaseKind,
  activeTags: ScenarioTag[],
  rng: () => number,
  archetype?: PlaystyleArchetype | null,
): ScenarioTemplate {
  const tagOk = (t: ScenarioTemplate) =>
    !t.requiresTagScope || activeTags.some((tag) => tag.scope === t.requiresTagScope);

  // Priorite aux gabarits qui mentionnent explicitement le style de jeu detecte du camp gagnant.
  if (archetype) {
    const archetypeMatches = SCENARIO_TEMPLATES.filter(
      (t) => t.kind === kind && t.archetype === archetype && tagOk(t),
    );
    if (archetypeMatches.length) return archetypeMatches[Math.floor(rng() * archetypeMatches.length)];
  }

  const eligible = SCENARIO_TEMPLATES.filter((t) => t.kind === kind && !t.archetype && tagOk(t));
  const pool = eligible.length ? eligible : SCENARIO_TEMPLATES.filter((t) => t.kind === kind && !t.archetype);
  return pool[Math.floor(rng() * pool.length)];
}

/**
 * Genere le scenario d'un match : phases timees, cohérence causale via un
 * petit vocabulaire de tags portes, et une passe de correction qui garantit
 * que l'issue narrative respecte `winnerSide` (deja decide par
 * DraftScoringEngine, jamais recalcule ici). Entierement deterministe via
 * `matchSeed` : deux appels avec le meme seed produisent le meme scenario.
 */
export class MatchScenarioEngine {
  static generate(input: MatchScenarioInput): MatchScenario {
    const rng = mulberry32(hashSeed(input.matchSeed));
    const phaseCount = 5 + Math.floor(rng() * 3);

    // Phase A — decide kind + camp favorise pour chaque etape, sans texte.
    const drafts: PhaseDraft[] = [];
    for (let i = 0; i < phaseCount; i++) {
      const ratio = phaseCount === 1 ? 1 : i / (phaseCount - 1);
      const [minMin, maxMin] = MINUTE_BANDS[Math.min(i, MINUTE_BANDS.length - 1)];
      const minute = minMin + Math.floor(rng() * (maxMin - minMin + 1));
      const kind = pickKind(ratio, rng);
      drafts.push(this.draftPhase(kind, minute, input, rng));
    }
    drafts.sort((a, b) => a.minute - b.minute);

    // Phase B — corrige pour que l'ensemble penche reellement vers le vainqueur reel.
    this.correctBias(drafts, input.winnerSide);

    // Phase C — rend le texte, phase apres phase, avec continuite narrative.
    const activeTags: ScenarioTag[] = [];
    const phases: ScenarioPhase[] = drafts.map((draft, i) =>
      this.renderPhase(draft, i, input, activeTags, rng),
    );

    return {
      seed: input.matchSeed,
      phases,
      winnerSide: input.winnerSide,
      closingLine: this.buildClosingLine(phases, input),
    };
  }

  private static draftPhase(
    kind: ScenarioPhaseKind,
    minute: number,
    input: MatchScenarioInput,
    rng: () => number,
  ): PhaseDraft {
    const label = `Phase - ${minute} min`;
    if (kind === 'lane') {
      const role = ROLES[Math.floor(rng() * ROLES.length)];
      const roleIndex = ROLES.indexOf(role);
      const champTeamA = input.teamA.champions[roleIndex];
      const champTeamB = input.teamB.champions[roleIndex];
      const { side, hint, strength } = laneAdvantage(champTeamA, champTeamB);
      return {
        minute,
        label,
        kind,
        favors: side,
        naturalFavors: side,
        confidence: Math.abs(strength - 0.5) * 2,
        role,
        champTeamA,
        champTeamB,
        hint,
        hintStrength: strength,
      };
    }

    let diff = 0;
    if (kind === 'skirmish') {
      diff = clamp(
        factorDiff(input, 'engage') / 20 +
          (countTag(input.teamA.champions, 'mobility') - countTag(input.teamB.champions, 'mobility')) / 6,
      );
    } else if (kind === 'objective') {
      diff = clamp((factorDiff(input, 'engage') + factorDiff(input, 'frontline')) / 30);
    } else if (kind === 'teamfight') {
      diff = clamp((factorDiff(input, 'cc') + factorDiff(input, 'assassin-overload') + factorDiff(input, 'engage')) / 35);
    } else {
      diff = clamp(factorDiff(input, 'scaling') / 15 + factorDiff(input, 'budget') / 10);
    }
    const side = biasToSide(diff, rng);
    return { minute, label, kind, favors: side, naturalFavors: side, confidence: Math.abs(diff) };
  }

  /** Flip les phases les moins tranchees si l'ensemble ne penche pas vers le vrai vainqueur, et force la derniere phase. */
  private static correctBias(drafts: PhaseDraft[], winnerSide: ScenarioSide): void {
    const loserSide: ScenarioSide = winnerSide === 'A' ? 'B' : 'A';
    const weightOf = (kind: ScenarioPhaseKind) => (kind === 'teamfight' || kind === 'objective' ? 2 : 1);
    let score = drafts.reduce((sum, d) => sum + (d.favors === winnerSide ? weightOf(d.kind) : -weightOf(d.kind)), 0);

    if (score <= 0) {
      const flippable = drafts
        .filter((d) => d.favors === loserSide)
        .sort((a, b) => a.confidence - b.confidence || weightOf(a.kind) - weightOf(b.kind));
      for (const draft of flippable) {
        draft.favors = winnerSide;
        score += weightOf(draft.kind) * 2;
        if (score > 0) break;
      }
    }

    const last = drafts[drafts.length - 1];
    if (last.favors !== winnerSide) last.favors = winnerSide;
  }

  private static renderPhase(
    draft: PhaseDraft,
    index: number,
    input: MatchScenarioInput,
    activeTags: ScenarioTag[],
    rng: () => number,
  ): ScenarioPhase {
    const label = `Phase ${index + 1} - ${draft.minute} min`;
    const winnerArchetype = draft.favors === 'A' ? input.teamA.archetype : input.teamB.archetype;
    const verb = winnerArchetype ? ARCHETYPE_VERBS[winnerArchetype] : '';

    if (draft.kind === 'lane' && draft.champTeamA && draft.champTeamB) {
      const winnerChamp = draft.favors === 'A' ? draft.champTeamA : draft.champTeamB;
      const loserChamp = draft.favors === 'A' ? draft.champTeamB : draft.champTeamA;
      const roleLabel = ROLE_LABEL[draft.role!];
      let text: string;
      if (isSbire(loserChamp) && !isSbire(winnerChamp)) {
        text = fill(pickSbireLine('lane', rng), { winner: winnerChamp.name, loser: loserChamp.name, role: roleLabel, verb });
      } else if (draft.hint && draft.favors === draft.naturalFavors) {
        text = fill(draft.hint, { winner: winnerChamp.name, loser: loserChamp.name, role: roleLabel, verb });
        if ((draft.hintStrength ?? 0.5) > 0.6) activeTags.push({ scope: 'fed', side: draft.favors });
      } else if (draft.hint) {
        const upset = SCENARIO_TEMPLATES.find((t) => t.id === 'lane-upset')!;
        text = fill(upset.text, { winner: winnerChamp.name, loser: loserChamp.name, role: roleLabel, verb });
      } else {
        const template = pickTemplate('lane', activeTags, rng, winnerArchetype);
        text = fill(template.text, { winner: winnerChamp.name, loser: loserChamp.name, role: roleLabel, verb });
        if (template.emitsTagScope) activeTags.push({ scope: template.emitsTagScope, side: draft.favors });
      }
      return {
        minute: draft.minute,
        label,
        kind: draft.kind,
        text,
        favors: draft.favors,
        championId: winnerChamp.id,
        opponentChampionId: loserChamp.id,
      };
    }

    const repA = pickRepresentativeForPhase(input.teamA.champions, draft.kind, rng);
    const repB = pickRepresentativeForPhase(input.teamB.champions, draft.kind, rng);
    const winnerChamp = draft.favors === 'A' ? repA : repB;
    const loserChamp = draft.favors === 'A' ? repB : repA;
    const template = pickTemplate(draft.kind, activeTags, rng, winnerArchetype);
    const objective = draft.kind === 'objective' ? objectiveNameFor(draft.minute, rng) : undefined;
    const role = draft.kind === 'skirmish' ? ROLE_LABEL[ROLES[Math.floor(rng() * ROLES.length)]] : undefined;
    const text = fill(template.text, {
      winner: winnerChamp.name,
      loser: loserChamp.name,
      objective: objective ?? '',
      role: role ?? '',
      verb,
    });
    if (template.emitsTagScope) activeTags.push({ scope: template.emitsTagScope, side: draft.favors });
    return { minute: draft.minute, label, kind: draft.kind, text, favors: draft.favors, championId: winnerChamp.id };
  }

  private static buildClosingLine(phases: ScenarioPhase[], input: MatchScenarioInput): string {
    const winnerSide = input.winnerSide;
    const decisive = [...phases]
      .reverse()
      .find((p) => p.favors === winnerSide && (p.kind === 'teamfight' || p.kind === 'objective' || p.kind === 'macro'));
    const anchor = decisive ?? phases[phases.length - 1];
    return `${anchor.text} C'est ce moment qui scelle la victoire.`;
  }
}
