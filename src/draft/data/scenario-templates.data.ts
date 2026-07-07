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
    "Le sbire {loser} rate ses dernier coups en {role}, {winner} n'a meme pas besoin de forcer.",
  ],
  skirmish: [
    'Le sbire {loser} se fait cueillir par {winner} en pleine rotation : plus une punition qu\'un combat.',
    '{winner} tombe sur le sbire {loser} et repart avec le kill le plus facile de sa carriere.',
    'Le sbire {loser} arrive en retard sur le skirmish et {winner} a deja fini le travail.',
  ],
  objective: [
    '{winner} prend {objective} tranquillement pendant que le sbire {loser} regarde depuis la fontaine.',
    'Le sbire {loser} tente bien de contester {objective}, mais {winner} le balaie sans y penser.',
  ],
  teamfight: [
    'Le sbire {loser} se pointe au teamfight, se fait one-shot, et repart direct en spectateur.',
    '{winner} ignore superbement le sbire {loser}, qui fait de la figuration dans ce fight.',
    'Le sbire {loser} clique sur sa premiere competence et meurt avant la fin de l\'animation face a {winner}.',
  ],
  macro: [
    'Le sbire {loser} pese si peu dans la macro que {winner} joue quasiment a 5 contre 4.',
    'La map se joue sans le sbire {loser}, que {winner} traite comme un PNJ de plus.',
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
    text: "Personne ne l'avait vu venir : {winner} retourne completement la lane face a {loser} en {role}.",
  },
  {
    id: 'lane-freeze',
    kind: 'lane',
    text: '{winner} freeze la lane sous tourelle en {role} et {loser} n\'ose plus s\'approcher pour farmer.',
  },
  {
    id: 'lane-cs-diff',
    kind: 'lane',
    emitsTagScope: 'fed',
    text: 'Rien de spectaculaire, juste un ecart de creeps qui se creuse : {winner} laisse {loser} sur le carreau en {role}.',
  },
  {
    id: 'lane-allin',
    kind: 'lane',
    text: 'All-in a level 6 en {role} : {winner} pop son ultime au bon moment et {loser} n\'a pas le temps de reagir.',
  },
  {
    id: 'lane-trade-bad',
    kind: 'lane',
    text: '{loser} force un trade limite en {role} et {winner} en profite carrement pour prendre l\'avantage.',
  },
  {
    id: 'lane-tower-dive',
    kind: 'lane',
    emitsTagScope: 'fed',
    text: '{winner} plonge sous tourelle en {role}, ca passe de justesse, et {loser} repart en respawn a poil.',
  },
  {
    id: 'lane-wave-management',
    kind: 'lane',
    text: '{winner} gere sa wave a la perfection en {role} pendant que {loser} rate ses sbires un par un.',
  },
  {
    id: 'lane-flash-punish',
    kind: 'lane',
    text: '{loser} flash pour rien en {role} face a une feinte de {winner}, qui prend la lane en solo desormais.',
  },
  {
    id: 'lane-scaling-early',
    kind: 'lane',
    text: '{winner} a le meilleur early de son champion en {role} et enterre {loser} avant meme la dixieme minute.',
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
  {
    id: 'skirmish-counter-gank',
    kind: 'skirmish',
    emitsTagScope: 'pick',
    text: '{loser} vient ganker et se fait counter-gank en pleine action : {winner} repart avec un double kill franchement clean.',
  },
  {
    id: 'skirmish-river-fight',
    kind: 'skirmish',
    text: 'Bagarre a 3 dans la riviere : {winner} sort largement gagnant face a {loser}, qui repart les mains vides.',
  },
  {
    id: 'skirmish-vision-denial',
    kind: 'skirmish',
    emitsTagScope: 'pick',
    text: '{winner} nettoie la vision adverse et tombe direct sur {loser}, qui n\'avait rien vu venir.',
  },
  {
    id: 'skirmish-herald-fight',
    kind: 'skirmish',
    text: 'Escarmouche autour de la zone du Heraut : {winner} prend le dessus et repousse {loser} sans forcer.',
  },
  {
    id: 'skirmish-tp-play',
    kind: 'skirmish',
    emitsTagScope: 'pick',
    text: '{winner} teleporte au bon moment sur le skirmish et prend {loser} par surprise, personne ne s\'y attendait.',
  },
  {
    id: 'skirmish-3v3-mid',
    kind: 'skirmish',
    text: 'Trois contre trois en mid lane : {winner} gagne l\'echange de sorts et {loser} doit reculer en respawn.',
  },
  {
    id: 'skirmish-jungle-track',
    kind: 'skirmish',
    emitsTagScope: 'pick',
    text: '{winner} track la jungle de {loser} a la trace et le cueille en pleine clear, zero chill.',
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
  {
    id: 'objective-smite-duel',
    kind: 'objective',
    emitsTagScope: 'objective',
    text: 'Duel de smite sur {objective} : {winner} le vole au nez et a la barbe de {loser}, qui reste bouche bee.',
  },
  {
    id: 'objective-baron-power',
    kind: 'objective',
    emitsTagScope: 'objective',
    text: '{winner} pose la vision autour de {objective} minute apres minute et {loser} n\'a jamais l\'ouverture pour repondre.',
  },
  {
    id: 'objective-atakhan-grab',
    kind: 'objective',
    emitsTagScope: 'objective',
    text: '{winner} se presente en premier devant {objective} et repart avec le bonus, {loser} arrive juste trop tard.',
  },
  {
    id: 'objective-sacrifice',
    kind: 'objective',
    text: '{loser} sacrifie deux joueurs pour tenter de contester {objective}, mais {winner} le prend quand meme sans forcer.',
  },
  {
    id: 'objective-flash-steal',
    kind: 'objective',
    emitsTagScope: 'objective',
    text: 'Steal a la limite du timer sur {objective} : {winner} flash au bon endroit et humilie {loser} devant tout le monde.',
  },
  {
    id: 'objective-tower-trade',
    kind: 'objective',
    text: '{winner} echange {objective} contre une tourelle et sort largement gagnant de l\'echange face a {loser}.',
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
  {
    id: 'teamfight-baron-fight',
    kind: 'teamfight',
    requiresTagScope: 'objective',
    text: 'Fight autour du buff tout juste pris : {winner} deferle sur {loser} et transforme l\'avantage en ace complet.',
  },
  {
    id: 'teamfight-peel',
    kind: 'teamfight',
    text: 'Le carry de {winner} est protege a la perfection pendant que {loser} se fait dechiqueter sans jamais l\'atteindre.',
  },
  {
    id: 'teamfight-ace',
    kind: 'teamfight',
    text: 'Ace total pour {winner} : les cinq membres de {loser} tombent en moins de dix secondes, carrement humiliant.',
  },
  {
    id: 'teamfight-missplay',
    kind: 'teamfight',
    text: '{loser} engage au mauvais moment, {winner} punit l\'erreur immediatement et le fight se termine aussi vite qu\'il a commence.',
  },
  {
    id: 'teamfight-baron-steal',
    kind: 'teamfight',
    text: 'En plein teamfight, {winner} vole le buff sous le nez de {loser} avant de finir le travail au corps a corps.',
  },
  {
    id: 'teamfight-flank',
    kind: 'teamfight',
    text: 'Flank parfait de {winner} par les bushes : {loser} se retrouve pris en sandwich et perd le fight en quelques secondes.',
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
  {
    id: 'macro-siege',
    kind: 'macro',
    text: '{winner} siege les tourelles une par une et {loser} n\'a jamais assez de pression pour repondre ailleurs.',
  },
  {
    id: 'macro-tempo',
    kind: 'macro',
    requiresTagScope: 'fed',
    text: 'Chaque reset de {winner} arrive plus vite que celui de {loser}, qui se fait distancer sur le tempo pur.',
  },
  {
    id: 'macro-comeback',
    kind: 'macro',
    text: 'Malgre un early difficile, {winner} recolle petit a petit et finit par prendre l\'ascendant total sur {loser}.',
  },
  {
    id: 'macro-inhib',
    kind: 'macro',
    requiresTagScope: 'objective',
    text: '{winner} fait tomber un inhibiteur de {loser} et la partie bascule carrement dans son camp.',
  },
  {
    id: 'macro-item-power',
    kind: 'macro',
    text: 'Le power spike du deuxieme objet arrive pour {winner}, qui prend un ascendant que {loser} ne rattrapera plus.',
  },
  {
    id: 'macro-throw-avoided',
    kind: 'macro',
    text: '{loser} tente une remontada mais {winner} garde son sang-froid et referme la partie sans trembler.',
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
    id: 'lane-dive-turret',
    kind: 'lane',
    archetype: 'dive',
    emitsTagScope: 'fed',
    text: 'Sous sa propre tourelle, {winner} {verb} {loser} en {role} sans se soucier des degats infliges par la plaque.',
  },
  {
    id: 'lane-poke',
    kind: 'lane',
    archetype: 'poke',
    text: '{winner} {verb} {loser} en {role}, toujours hors de portee, et grignote la lane point par point.',
  },
  {
    id: 'lane-poke-zone',
    kind: 'lane',
    archetype: 'poke',
    text: 'Impossible d\'approcher : {winner} {verb} {loser} en {role} des que sa barre de mana le permet.',
  },
  {
    id: 'lane-splitpush',
    kind: 'lane',
    archetype: 'splitpush',
    text: 'En {role}, {winner} {verb} et pousse sa wave toute seule pendant que {loser} n\'ose pas suivre.',
  },
  {
    id: 'skirmish-dive',
    kind: 'skirmish',
    archetype: 'dive',
    emitsTagScope: 'pick',
    text: "{winner} {verb} {loser} des que l'occasion se presente et repart avec un pick net.",
  },
  {
    id: 'skirmish-dive-backline',
    kind: 'skirmish',
    archetype: 'dive',
    emitsTagScope: 'pick',
    text: 'D\'un seul combo, {winner} {verb} la backline de {loser}, qui n\'a pas le temps de reagir.',
  },
  {
    id: 'skirmish-poke',
    kind: 'skirmish',
    archetype: 'poke',
    text: '{winner} {verb} avant tout engagement : {loser} arrive au fight deja affaibli.',
  },
  {
    id: 'skirmish-poke-siege',
    kind: 'skirmish',
    archetype: 'poke',
    text: 'A distance de securite, {winner} {verb} en boucle et {loser} perd la moitie de sa vie sans jamais toucher personne.',
  },
  {
    id: 'skirmish-teamfight-early',
    kind: 'skirmish',
    archetype: 'teamfight',
    emitsTagScope: 'pick',
    text: '{winner} {verb} des le premier contact et transforme un simple skirmish en fight decisif pour {loser}.',
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
    id: 'objective-poke-zone',
    kind: 'objective',
    archetype: 'poke',
    emitsTagScope: 'objective',
    text: '{winner} {verb} toute l\'equipe de {loser} qui tente d\'approcher {objective}, impossible de contester dans ces conditions.',
  },
  {
    id: 'objective-teamfight-around',
    kind: 'objective',
    archetype: 'teamfight',
    emitsTagScope: 'objective',
    text: 'Juste avant le spawn, {winner} {verb} sur la zone et prend {objective} apres avoir efface {loser}.',
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
    id: 'teamfight-poke-into-all-in',
    kind: 'teamfight',
    archetype: 'poke',
    text: '{winner} {verb} pendant de longues secondes avant l\'engagement final et {loser} arrive au corps a corps deja a sec de vie.',
  },
  {
    id: 'teamfight-splitpush-pressure',
    kind: 'teamfight',
    archetype: 'splitpush',
    text: 'Pendant que {winner} {verb} sur une side lane, le reste de son equipe profite de la diversion pour ecraser {loser}.',
  },
  {
    id: 'macro-splitpush-archetype',
    kind: 'macro',
    archetype: 'splitpush',
    text: '{winner} {verb}, et {loser} ne trouve jamais le bon moment pour repondre a temps.',
  },
  {
    id: 'macro-splitpush-4v5',
    kind: 'macro',
    archetype: 'splitpush',
    text: 'Pendant que {winner} {verb}, son equipe joue un 4 contre 5 gagnant et {loser} craque sous la pression constante.',
  },
  {
    id: 'macro-poke',
    kind: 'macro',
    archetype: 'poke',
    text: '{winner} {verb} sur chaque reset et use {loser} sans jamais prendre de risque.',
  },
  {
    id: 'macro-teamfight-snowball',
    kind: 'macro',
    archetype: 'teamfight',
    text: 'A chaque groupement, {winner} {verb} et {loser} perd de plus en plus de terrain sur la macro globale.',
  },
  {
    id: 'macro-dive-macro',
    kind: 'macro',
    archetype: 'dive',
    text: '{winner} {verb} les carries de {loser} des que la vision le permet, tourelle apres tourelle.',
  },
];
