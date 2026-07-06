import { StrategyCategory } from '../interfaces/draft.interface';

/**
 * Choix strategiques demandes apres la selection des 5 champions. Chaque
 * option est notee par DraftScoringEngine en fonction des tags de la
 * composition (jamais des noms de champions, meme principe que le reste du
 * moteur) : ajouter une option ici sans l'evaluer cote engine n'aura
 * simplement aucun effet sur le score.
 */
export const STRATEGY_CATEGORIES: StrategyCategory[] = [
  {
    id: 'playstyle',
    label: 'Style de jeu',
    prompt: "Comment cette equipe compte-t-elle jouer le teamfight ?",
    options: [
      { id: 'dive', label: 'Dive', description: "Rentrer sur le carry adverse des la premiere occasion." },
      { id: 'poke', label: 'Poke', description: 'Grignoter a distance avant tout engagement.' },
      { id: 'teamfight', label: 'Teamfight groupe', description: 'Tout miser sur un fight 5v5 range.' },
      { id: 'splitpush', label: 'Split-push', description: 'Diviser la map, eviter les fights groupes.' },
    ],
  },
  {
    id: 'macro',
    label: 'Priorite macro',
    prompt: 'Sur quoi cette equipe base-t-elle son macro-jeu ?',
    options: [
      { id: 'objectives', label: 'Objectifs', description: 'Priorite Baron/Dragon a chaque reset.' },
      { id: 'vision', label: 'Vision & controle', description: 'Wards, controle de jungle, information.' },
      { id: 'snowball', label: 'Snowball early', description: 'Forcer les fights des le level 6.' },
      { id: 'scaling', label: 'Scaling passif', description: 'Farmer sagement, laisser venir le late game.' },
    ],
  },
  {
    id: 'itemization',
    label: 'Itemisation',
    prompt: 'Vers quoi cette equipe build-t-elle ?',
    options: [
      { id: 'full-damage', label: 'Full degats', description: 'Maximiser le burst, prendre des risques.' },
      { id: 'resistances', label: 'Resistances', description: 'Survie avant tout, gagner par attrition.' },
      { id: 'utility', label: 'Utilitaire', description: 'Objets actifs, CC et peel pour le groupe.' },
    ],
  },
];
