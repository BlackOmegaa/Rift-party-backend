import { Champion } from '../interfaces/draft.interface';

/**
 * Archetypes de lane derives des tags existants (aucune nouvelle donnee par
 * champion) : sert de base heuristique au moteur de scenario pour juger d'un
 * duel de lane sans avoir a maintenir une matrice de contre-picks 83x83.
 * Un champion peut correspondre a plusieurs archetypes ; le moteur essaie
 * chaque paire dans l'ordre de `LANE_INTERACTIONS`.
 */
export type LaneArchetype =
  | 'early-bully'
  | 'scaling-duelist'
  | 'poke-ranged'
  | 'all-in-burst'
  | 'tank-frontline'
  | 'pick-assassin'
  | 'hyper-carry'
  | 'utility-support';

export function classifyArchetypes(champion: Champion): LaneArchetype[] {
  const tags = new Set(champion.tags);
  const archetypes: LaneArchetype[] = [];

  if (tags.has('tank')) archetypes.push('tank-frontline');
  if (tags.has('assassin') && tags.has('mobility')) archetypes.push('pick-assassin');
  if (
    tags.has('scaling-late') &&
    (tags.has('sustain') || tags.has('mobility')) &&
    !tags.has('assassin')
  ) {
    archetypes.push('scaling-duelist');
  }
  if (tags.has('poke') && !tags.has('assassin')) archetypes.push('poke-ranged');
  if (tags.has('burst') && tags.has('engage') && !tags.has('sustain')) {
    archetypes.push('all-in-burst');
  }
  if (tags.has('scaling-early') && !tags.has('sustain')) archetypes.push('early-bully');
  if (tags.has('scaling-late') && tags.has('marksman')) archetypes.push('hyper-carry');
  if (tags.has('support') && !tags.has('tank')) archetypes.push('utility-support');

  return archetypes.length ? archetypes : ['early-bully'];
}

export interface LaneInteraction {
  attacker: LaneArchetype;
  defender: LaneArchetype;
  /** 0-1 : probabilite que `attacker` gagne ce duel de lane. */
  advantage: number;
  /** {winner}/{loser} = noms de champions, remplis par le moteur. */
  narrativeHint: string;
}

/**
 * Heuristique d'interactions de lane. Pas exhaustif ni symetrique : seules
 * les interactions "interessantes" sont listees, le reste retombe sur un
 * duel neutre (voir match-scenario.engine.ts).
 */
export const LANE_INTERACTIONS: LaneInteraction[] = [
  {
    attacker: 'scaling-duelist',
    defender: 'all-in-burst',
    advantage: 0.66,
    narrativeHint: "la lane s'etire et {loser} n'a plus rien pour finir {winner}, qui prend le dessus au fil des trades.",
  },
  {
    attacker: 'poke-ranged',
    defender: 'all-in-burst',
    advantage: 0.6,
    narrativeHint: '{winner} harcele {loser} a distance : impossible de rentrer sans perdre la trade.',
  },
  {
    attacker: 'early-bully',
    defender: 'scaling-duelist',
    advantage: 0.62,
    narrativeHint: '{winner} bully la lane des le niveau 3, {loser} doit jouer safe en attendant de scaler.',
  },
  {
    attacker: 'scaling-duelist',
    defender: 'early-bully',
    advantage: 0.58,
    narrativeHint: "malgre un early difficile, {winner} a fini par scaler : {loser} n'a plus d'impact en lane.",
  },
  {
    attacker: 'pick-assassin',
    defender: 'hyper-carry',
    advantage: 0.64,
    narrativeHint: '{winner} isole et punit {loser} des la premiere rotation.',
  },
  {
    attacker: 'tank-frontline',
    defender: 'pick-assassin',
    advantage: 0.55,
    narrativeHint: "{winner} tank tout le kit d'engage de {loser}, qui ne perce jamais la frontline.",
  },
  {
    attacker: 'all-in-burst',
    defender: 'poke-ranged',
    advantage: 0.55,
    narrativeHint: '{winner} force le level 2 et punit {loser} avant que le poke ne fasse effet.',
  },
];
