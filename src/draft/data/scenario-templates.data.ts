import { PlaystyleArchetype, ScenarioPhaseKind, ScenarioTagScope } from '../interfaces/draft.interface';

/**
 * Bibliotheque de phrases pour MatchScenarioEngine, dans le meme esprit que
 * les anciens `duelScripts` du front mais decoupees par type de phase
 * (`kind`) plutot que par role fixe. `requiresTagScope` filtre l'eligibilite
 * d'un template selon les tags actives par les phases precedentes (voir
 * match-scenario.engine.ts) : c'est ce qui donne une continuite narrative
 * sans moteur d'inference general. Placeholders disponibles dans `text` :
 * {winner} {loser} {role} {objective} {verb} (verbe derive de l'archetype,
 * voir ARCHETYPE_VERBS, utilisable meme dans un template sans `archetype`).
 *
 * `archetype` (optionnel) : quand le camp qui remporte la phase a un style de
 * jeu detecte (voir detectArchetype), ces templates sont preferes aux
 * generiques ci-dessus pour que le recit mentionne explicitement ce style.
 */
export interface ScenarioTemplate {
  id: string;
  kind: ScenarioPhaseKind;
  requiresTagScope?: ScenarioTagScope;
  emitsTagScope?: ScenarioTagScope;
  archetype?: PlaystyleArchetype;
  text: string;
}

/**
 * Lignes speciales quand le camp perdant d'une phase repose sur un sbire
 * (champion gratuit, voir champions.data.ts::SBIRE_CHAMPIONS) : toujours un
 * peu d'humour ("farme", "gratuit ca se voit"), jamais un recit serieux —
 * coherent avec le fait qu'un sbire ne doit jamais "briller" ni etre presente
 * comme une menace. Utilisees par match-scenario.engine.ts a la place du
 * template normal des que le champion perdant d'une phase de lane est un sbire.
 */
export const SBIRE_LINES: Record<ScenarioPhaseKind, string[]> = {
  lane: [
    "En {role}, le sbire {loser} se fait tout simplement farmer par {winner} : gratuit, ca se voit.",
    "{winner} n'a besoin d'aucun effort pour dominer le sbire {loser} en {role}.",
    "Le sbire {loser} pousse sa lane en {role} et se fait ramasser par {winner} sans meme resister.",
  ],
  skirmish: [
    'Le sbire {loser} se fait cueillir par {winner} en pleine rotation : plus une punition qu\'un combat.',
    '{winner} tombe sur le sbire {loser} et repart avec le kill le plus facile de sa carriere.',
  ],
  objective: [
    '{winner} prend {objective} tranquillement pendant que le sbire {loser} regarde depuis la fontaine.',
  ],
  teamfight: [
    'Le sbire {loser} se pointe au teamfight, se fait one-shot, et repart direct en spectateur.',
    '{winner} ignore superbement le sbire {loser}, qui fait de la figuration dans ce fight.',
  ],
  macro: [
    'Le sbire {loser} pese si peu dans la macro que {winner} joue quasiment a 5 contre 4.',
  ],
};

export const ARCHETYPE_VERBS: Record<PlaystyleArchetype, string> = {
  dive: 'tente une plongee agressive sur',
  poke: 'harcele a distance',
  teamfight: 'engage le fight groupe contre',
  splitpush: "s'isole en side lane face a",
};

export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  // --- lane (fallback generique quand aucun matchup connu n'a ete trouve)
  {
    id: 'lane-fallback-close',
    kind: 'lane',
    text: "En {role}, {winner} prend legerement le dessus sur {loser} sans que la lane ne bascule vraiment.",
  },
  {
    id: 'lane-fallback-clean',
    kind: 'lane',
    emitsTagScope: 'fed',
    text: "{winner} sort vainqueur d'un echange nerveux face a {loser} en {role} et prend une avance nette.",
  },
  {
    id: 'lane-upset',
    kind: 'lane',
    text: "Contre toute attente, {winner} renverse la lane face a {loser} en {role}.",
  },

  // --- skirmish
  {
    id: 'skirmish-gank',
    kind: 'skirmish',
    emitsTagScope: 'pick',
    text: 'Premier gank de la partie : {winner} surprend {loser} et prend une avance nette.',
  },
  {
    id: 'skirmish-invade',
    kind: 'skirmish',
    text: "Invade du camp adverse : {winner} punit la jungle de {loser} des les premieres minutes.",
  },
  {
    id: 'skirmish-botlane-stomp',
    kind: 'skirmish',
    emitsTagScope: 'fed',
    text: 'La botlane de {winner} stomp completement celle de {loser}, plus rien ne pousse en bas.',
  },
  {
    id: 'skirmish-roam',
    kind: 'skirmish',
    requiresTagScope: 'fed',
    emitsTagScope: 'pick',
    text: "Deja en avance, {winner} roam sur les sides et pick {loser} isole.",
  },

  // --- objective
  {
    id: 'objective-secure',
    kind: 'objective',
    emitsTagScope: 'objective',
    text: '{winner} secure {objective} grace a une vision impeccable, {loser} ne peut rien contester.',
  },
  {
    id: 'objective-contest',
    kind: 'objective',
    emitsTagScope: 'objective',
    text: 'Contest chaotique sur {objective} : {winner} en sort avec le buff, {loser} perd du monde pour rien.',
  },
  {
    id: 'objective-continuation',
    kind: 'objective',
    requiresTagScope: 'fed',
    emitsTagScope: 'objective',
    text: 'Toujours en avance, {winner} prend {objective} sans meme que {loser} puisse repondre.',
  },

  // --- teamfight
  {
    id: 'teamfight-engage',
    kind: 'teamfight',
    text: "Premier gros teamfight groupe : l'engage de {winner} fige {loser} et le combat tourne au massacre.",
  },
  {
    id: 'teamfight-continuation',
    kind: 'teamfight',
    requiresTagScope: 'fed',
    text: '{winner}, toujours devant depuis le early game, transforme le moindre engagement en ace pour {loser}.',
  },
  {
    id: 'teamfight-pick-followup',
    kind: 'teamfight',
    requiresTagScope: 'pick',
    text: 'Fort du pick precedent, {winner} arrive en nombre superieur sur le fight et ne laisse aucune chance a {loser}.',
  },
  {
    id: 'teamfight-comeback',
    kind: 'teamfight',
    text: '{winner} trouve enfin le fight parfait et renverse {loser} en un seul combo decisif.',
  },

  // --- macro
  {
    id: 'macro-scaling',
    kind: 'macro',
    text: "La composition de {winner} finit par ecraser celle de {loser} sur le pur scaling des objets.",
  },
  {
    id: 'macro-splitpush',
    kind: 'macro',
    text: 'Pendant que {loser} tente de grouper, {winner} split la map et force des reponses impossibles a tenir.',
  },
  {
    id: 'macro-vision',
    kind: 'macro',
    requiresTagScope: 'objective',
    text: 'Le controle de vision impose par {winner} etouffe completement {loser}, qui ne voit plus rien venir.',
  },

  // --- variantes archetype-aware : preferees quand le camp gagnant a un style de jeu detecte (voir detectArchetype).
  {
    id: 'lane-dive',
    kind: 'lane',
    archetype: 'dive',
    emitsTagScope: 'fed',
    text: '{winner} {verb} {loser} en {role} des la premiere occasion et prend une avance nette.',
  },
  {
    id: 'lane-poke',
    kind: 'lane',
    archetype: 'poke',
    text: '{winner} {verb} {loser} en {role}, toujours hors de portee, et grignote la lane point par point.',
  },
  {
    id: 'skirmish-dive',
    kind: 'skirmish',
    archetype: 'dive',
    emitsTagScope: 'pick',
    text: "{winner} {verb} {loser} des que l'occasion se presente et repart avec un pick net.",
  },
  {
    id: 'skirmish-poke',
    kind: 'skirmish',
    archetype: 'poke',
    text: '{winner} {verb} avant tout engagement : {loser} arrive au fight deja affaibli.',
  },
  {
    id: 'objective-dive',
    kind: 'objective',
    archetype: 'dive',
    emitsTagScope: 'objective',
    text: '{winner} {verb} le carry de {loser} au moment du reset et prend {objective} dans la foulee.',
  },
  {
    id: 'objective-splitpush',
    kind: 'objective',
    archetype: 'splitpush',
    emitsTagScope: 'objective',
    text: 'Pendant que {winner} {verb}, {loser} doit choisir entre repondre en side ou perdre {objective}.',
  },
  {
    id: 'teamfight-teamfight',
    kind: 'teamfight',
    archetype: 'teamfight',
    text: '{winner} {verb} : le controle de foule fige tout le monde et {loser} ne peut plus rien faire.',
  },
  {
    id: 'teamfight-dive',
    kind: 'teamfight',
    archetype: 'dive',
    text: '{winner} {verb} le carry de {loser} en une fraction de seconde, le fight est deja plie.',
  },
  {
    id: 'macro-splitpush-archetype',
    kind: 'macro',
    archetype: 'splitpush',
    text: '{winner} {verb}, et {loser} ne trouve jamais le bon moment pour repondre a temps.',
  },
  {
    id: 'macro-poke',
    kind: 'macro',
    archetype: 'poke',
    text: '{winner} {verb} sur chaque reset et use {loser} sans jamais prendre de risque.',
  },
];
