import { SynergyRule } from '../interfaces/draft.interface';

/**
 * Combos "iconiques" a bonus. Volontairement une petite liste ciblee plutot
 * qu'un systeme combinatoire complexe : facile a comprendre pour un joueur,
 * facile a etendre (il suffit d'ajouter une ligne).
 */
export const SYNERGY_RULES: SynergyRule[] = [
  { championIds: ['yasuo', 'malphite'], points: 12, label: 'Yasuo + Malphite : Malphite aligne tout le monde, Yasuo empale avec sa capitale. Combo iconique.' },
  { championIds: ['yasuo', 'amumu'], points: 10, label: 'Yasuo + Amumu : bandage + tornade, wombo combo en AoE.' },
  { championIds: ['yasuo', 'nautilus'], points: 10, label: 'Yasuo + Nautilus : root/knockup en chaine pour enchainer la capitale.' },
  { championIds: ['orianna', 'malphite'], points: 10, label: 'Orianna + Malphite : shockwave apres un engage groupe, degats AoE garantis.' },
  { championIds: ['orianna', 'amumu'], points: 10, label: 'Orianna + Amumu : stun groupe puis shockwave, teamfight plie en 3 secondes.' },
  { championIds: ['leona', 'jinx'], points: 8, label: 'Leona + Jinx : engage/peel lourd pour proteger la carry a degats late-game.' },
  { championIds: ['leona', 'vayne'], points: 8, label: 'Leona + Vayne : chain-CC pour permettre a Vayne de vider son kit en securite.' },
  { championIds: ['thresh', 'jinx'], points: 8, label: 'Thresh + Jinx : hook pour initier, lantern pour securiser la carry.' },
  { championIds: ['braum', 'vayne'], points: 8, label: 'Braum + Vayne : les stacks de passif de Braum synergisent avec l\'attack speed de Vayne.' },
  { championIds: ['soraka', 'morgana'], points: 6, label: 'Soraka + Morgana : sustain + anti-engage, tres dur a burst en teamfight.' },
  { championIds: ['zed', 'katarina'], points: 5, label: 'Zed + Katarina : double fenetre de burst, capable d\'effacer une cible en un cycle.' },
  { championIds: ['ahri', 'orianna'], points: 5, label: 'Ahri + Orianna : double peel/poke magique, controle de zone en mid-late.' },
];
