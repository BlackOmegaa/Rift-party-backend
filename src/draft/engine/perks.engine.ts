import { Champion, Perk, StrategySelections } from '../interfaces/draft.interface';
import { countByTag, detectArchetype } from './draft-scoring.engine';

interface PerkDefinition {
  id: string;
  label: string;
  icon: string;
  points: number;
  condition: (ctx: PerkContext) => boolean;
}

interface PerkContext {
  champions: Champion[];
  totalCc: number;
  engage: number;
  disengage: number;
  scalingEarly: number;
  scalingLate: number;
  tank: number;
  assassin: number;
  poke: number;
  archetype: ReturnType<typeof detectArchetype>;
}

/**
 * Badges de variete : pas juste "bien score", mais une identite de comp bien
 * marquee (au moins 2 signaux forts). Purement cosmetique + petit bonus de
 * score (+5 chacun) : evite que les parties se ressemblent toutes une fois
 * qu'on regarde juste le score final.
 */
const PERK_DEFINITIONS: PerkDefinition[] = [
  {
    id: 'machine-de-guerre',
    label: 'Machine de guerre',
    icon: 'skull',
    points: 5,
    condition: (ctx) => ctx.totalCc >= 12 && ctx.engage >= 3,
  },
  {
    id: 'vision-divine',
    label: 'Vision divine',
    icon: 'radio',
    points: 5,
    condition: (ctx) => ctx.disengage >= 2 && ctx.scalingLate >= 2,
  },
  {
    id: 'snowball-parfait',
    label: 'Snowball parfait',
    icon: 'comet',
    points: 5,
    condition: (ctx) => ctx.scalingEarly >= 3 && ctx.archetype === 'dive',
  },
  {
    id: 'muraille-vivante',
    label: 'Muraille vivante',
    icon: 'shield',
    points: 5,
    condition: (ctx) => ctx.tank >= 3,
  },
  {
    id: 'orchestre-de-poke',
    label: "Orchestre de poke",
    icon: 'comet',
    points: 5,
    condition: (ctx) => ctx.poke >= 3 && ctx.archetype === 'poke',
  },
  {
    id: 'escouade-fantome',
    label: 'Escouade fantome',
    icon: 'mask',
    points: 5,
    condition: (ctx) => ctx.assassin >= 3,
  },
  {
    id: 'coherence-totale',
    label: 'Coherence totale',
    icon: 'sparkle',
    points: 5,
    condition: (ctx) => ctx.archetype !== null,
  },
];

export class PerksEngine {
  static detect(champions: Champion[], strategySelections?: StrategySelections): { perks: Perk[]; bonusPoints: number } {
    const ctx: PerkContext = {
      champions,
      totalCc: champions.reduce((sum, c) => sum + c.ccScore, 0),
      engage: countByTag(champions, 'engage'),
      disengage: countByTag(champions, 'disengage'),
      scalingEarly: countByTag(champions, 'scaling-early'),
      scalingLate: countByTag(champions, 'scaling-late'),
      tank: countByTag(champions, 'tank'),
      assassin: countByTag(champions, 'assassin'),
      poke: countByTag(champions, 'poke'),
      archetype: detectArchetype(champions, strategySelections),
    };

    const matched = PERK_DEFINITIONS.filter((def) => def.condition(ctx)).slice(0, 2);
    const perks: Perk[] = matched.map((def) => ({ id: def.id, label: def.label, icon: def.icon }));
    const bonusPoints = matched.reduce((sum, def) => sum + def.points, 0);
    return { perks, bonusPoints };
  }
}
