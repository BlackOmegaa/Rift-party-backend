/**
 * Petite liste curatee de contre-picks emblematiques, consultee en priorite
 * par le moteur de scenario avant de retomber sur l'heuristique d'archetypes
 * (lane-archetypes.data.ts). Volontairement non exhaustive : meme principe
 * que synergies.data.ts, on ajoute une ligne ici pour un matchup "connu",
 * le reste est couvert par l'heuristique generique.
 */
export interface IconicMatchup {
  championIdA: string;
  championIdB: string;
  /** Cote favorise par ce matchup, avec quelle force (0-1). */
  favors: 'A' | 'B';
  strength: number;
  /** {winner}/{loser} = noms de champions, remplis par le moteur. */
  narrativeHint: string;
}

export const ICONIC_MATCHUPS: IconicMatchup[] = [
  {
    championIdA: 'jax',
    championIdB: 'fiora',
    favors: 'B',
    strength: 0.62,
    narrativeHint: '{winner} esquive le stun de {loser} et gagne la course aux procs sur toute la lane.',
  },
  {
    championIdA: 'darius',
    championIdB: 'vayne',
    favors: 'A',
    strength: 0.68,
    narrativeHint: "{winner} stack son saignement avant que {loser} n'ait la moindre fenetre pour kiter.",
  },
  {
    championIdA: 'renekton',
    championIdB: 'jax',
    favors: 'A',
    strength: 0.6,
    narrativeHint: '{winner} punit chaque trade avant le niveau 6, {loser} ne peut jamais stabiliser.',
  },
  {
    championIdA: 'camille',
    championIdB: 'riven',
    favors: 'A',
    strength: 0.58,
    narrativeHint: '{winner} true damage la fin du duel, {loser} manque juste de burst pour finir avant.',
  },
  {
    championIdA: 'garen',
    championIdB: 'vayne',
    favors: 'A',
    strength: 0.6,
    narrativeHint: "{winner} silence et burst avant que {loser} n'ait sa fenetre de carry.",
  },
  {
    championIdA: 'yasuo',
    championIdB: 'azir',
    favors: 'B',
    strength: 0.6,
    narrativeHint: '{winner} clear la wave a distance et poke {loser} sans jamais le laisser approcher.',
  },
  {
    championIdA: 'zed',
    championIdB: 'lissandra',
    favors: 'B',
    strength: 0.6,
    narrativeHint: '{winner} self-peel avec son ultime des que {loser} engage.',
  },
  {
    championIdA: 'akali',
    championIdB: 'galio',
    favors: 'B',
    strength: 0.63,
    narrativeHint: '{winner} silence {loser} au moment cle, resistances magiques a l\'appui.',
  },
  {
    championIdA: 'katarina',
    championIdB: 'galio',
    favors: 'B',
    strength: 0.58,
    narrativeHint: "{winner} punit le reset de {loser} avant qu'il ne puisse repartir en dague.",
  },
  {
    championIdA: 'irelia',
    championIdB: 'jax',
    favors: 'B',
    strength: 0.55,
    narrativeHint: '{winner} esquive les stuns aux bons moments et gagne les trades prolonges.',
  },
  {
    championIdA: 'caitlyn',
    championIdB: 'draven',
    favors: 'A',
    strength: 0.58,
    narrativeHint: '{winner} garde {loser} a distance de sa hache toute la lane.',
  },
  {
    championIdA: 'draven',
    championIdB: 'jhin',
    favors: 'A',
    strength: 0.6,
    narrativeHint: "{winner} force l'all-in avant que {loser} n'ait ses quatre balles en place.",
  },
  {
    championIdA: 'nautilus',
    championIdB: 'thresh',
    favors: 'B',
    strength: 0.55,
    narrativeHint: '{winner} land son hook en premier et gagne la course a l\'engage.',
  },
  {
    championIdA: 'leona',
    championIdB: 'janna',
    favors: 'A',
    strength: 0.6,
    narrativeHint: "{winner} engage avant que {loser} n'ait le temps de peel.",
  },
  {
    championIdA: 'blitzcrank',
    championIdB: 'janna',
    favors: 'B',
    strength: 0.58,
    narrativeHint: '{winner} souffle chaque tentative de crochet de {loser}.',
  },
  {
    championIdA: 'khazix',
    championIdB: 'graves',
    favors: 'B',
    strength: 0.58,
    narrativeHint: "{winner} sustain et clear plus vite, l'invade de {loser} tourne court.",
  },
  {
    championIdA: 'lee-sin',
    championIdB: 'sejuani',
    favors: 'A',
    strength: 0.6,
    narrativeHint: '{winner} impose son tempo avant que {loser} ne monte en puissance.',
  },
  {
    championIdA: 'vi',
    championIdB: 'elise',
    favors: 'A',
    strength: 0.58,
    narrativeHint: "{winner} tank l'invade et retourne le camp de {loser}.",
  },
  {
    championIdA: 'samira',
    championIdB: 'ashe',
    favors: 'B',
    strength: 0.57,
    narrativeHint: '{winner} kite et cc {loser} avant que la moindre combo ne parte.',
  },
];
