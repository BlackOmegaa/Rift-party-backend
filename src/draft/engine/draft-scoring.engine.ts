import {
  Champion,
  ChampionTag,
  DraftFactorBreakdown,
  PlaystyleArchetype,
  Role,
  StrategySelections,
} from '../interfaces/draft.interface';
import { SYNERGY_RULES } from './synergies.data';

const ALL_ROLES: Role[] = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
const BASE_SCORE = 50;

/** Categorie macro/itemisation "attendue" pour chaque archetype : sert au bonus d'identite d'equipe (evaluate()) et au choix de gabarit narratif (match-scenario.engine.ts). */
export const ARCHETYPE_ALIGNMENT: Record<PlaystyleArchetype, { macro: string; itemization: string }> = {
  dive: { macro: 'snowball', itemization: 'full-damage' },
  poke: { macro: 'vision', itemization: 'utility' },
  teamfight: { macro: 'objectives', itemization: 'resistances' },
  splitpush: { macro: 'scaling', itemization: 'resistances' },
};

export function countByTag(champions: Champion[], tag: ChampionTag): number {
  return champions.filter((c) => c.tags.includes(tag)).length;
}

/**
 * Detecte l'archetype de jeu d'une equipe : uniquement si le style de jeu
 * choisi est REELLEMENT confirme par les tags des champions piochés (memes
 * seuils que les bonus `strategy:playstyle` positifs ci-dessous). Un choix de
 * style non confirme par la comp ne "compte" pas comme identite d'equipe.
 * Reutilise par le bonus de score (evaluate()) et par le narratif de combat
 * (draft.service.ts::buildMatchScenario -> match-scenario.engine.ts).
 */
export function detectArchetype(
  champions: Champion[],
  selections?: StrategySelections,
): PlaystyleArchetype | null {
  if (!selections?.playstyle) return null;
  const engage = countByTag(champions, 'engage');
  const poke = countByTag(champions, 'poke');
  const assassin = countByTag(champions, 'assassin');
  const fighter = countByTag(champions, 'fighter');
  const sustain = countByTag(champions, 'sustain');
  const scalingLate = countByTag(champions, 'scaling-late');
  const totalCc = champions.reduce((sum, c) => sum + c.ccScore, 0);

  switch (selections.playstyle) {
    case 'dive':
      return engage >= 2 && assassin + fighter >= 2 ? 'dive' : null;
    case 'poke':
      return poke >= 2 ? 'poke' : null;
    case 'teamfight':
      return totalCc >= 8 ? 'teamfight' : null;
    case 'splitpush':
      return scalingLate >= 2 && sustain >= 1 ? 'splitpush' : null;
    default:
      return null;
  }
}

/**
 * Note les choix strategiques (style de jeu, macro, itemisation) en fonction
 * des tags de la composition, jamais des noms de champions : coherence avec
 * `evaluate()`. Une option non geree ici (ou absente de la selection) est
 * simplement neutre, pas d'erreur.
 */
function evaluateStrategy(
  champions: Champion[],
  selections: StrategySelections | undefined,
  push: (key: string, label: string, points: number) => void,
): void {
  if (!selections) return;
  const engage = countByTag(champions, 'engage');
  const poke = countByTag(champions, 'poke');
  const assassin = countByTag(champions, 'assassin');
  const fighter = countByTag(champions, 'fighter');
  const tank = countByTag(champions, 'tank');
  const sustain = countByTag(champions, 'sustain');
  const disengage = countByTag(champions, 'disengage');
  const scalingEarly = countByTag(champions, 'scaling-early');
  const scalingLate = countByTag(champions, 'scaling-late');
  const totalCc = champions.reduce((sum, c) => sum + c.ccScore, 0);
  const ad = countByTag(champions, 'ad');
  const ap = countByTag(champions, 'ap');

  switch (selections.playstyle) {
    case 'dive':
      if (engage >= 2 && assassin + fighter >= 2) {
        push('strategy:playstyle', 'Dive coherent : engage et duelistes pour rentrer dans le carry.', 8);
      } else if (poke >= 3 && engage === 0) {
        push('strategy:playstyle', 'Dive choisi mais aucune capacite d\'engage : le plan ne colle pas au kit.', -8);
      }
      break;
    case 'poke':
      if (poke >= 2) {
        push('strategy:playstyle', 'Poke coherent : plusieurs champions capables de harceler a distance.', 8);
      } else if (assassin >= 3) {
        push('strategy:playstyle', 'Poke choisi avec une comp d\'assassins : le plan ne colle pas au kit.', -8);
      }
      break;
    case 'teamfight':
      if (totalCc >= 8) {
        push('strategy:playstyle', 'Teamfight groupe coherent : controle de foule suffisant pour figer le fight.', 8);
      } else if (assassin >= 3) {
        push('strategy:playstyle', 'Teamfight groupe avec trop d\'assassins : la comp explose en fight prolonge.', -8);
      }
      break;
    case 'splitpush':
      if (scalingLate >= 2 && sustain >= 1) {
        push('strategy:playstyle', 'Split-push coherent : duelistes qui scale et tiennent leur lane.', 8);
      } else if (scalingEarly === champions.length) {
        push('strategy:playstyle', 'Split-push choisi avec une comp qui veut snowball vite : contradiction de plan.', -6);
      }
      break;
  }

  switch (selections.macro) {
    case 'objectives':
      if (tank >= 1 && engage >= 1) {
        push('strategy:macro', 'Priorite objectifs coherente : de quoi engager pour secure Baron/Dragon.', 6);
      }
      break;
    case 'vision':
      if (disengage >= 1) {
        push('strategy:macro', 'Controle de map coherent : capacites de disengage pour securiser la vision.', 6);
      }
      break;
    case 'snowball':
      if (scalingEarly >= 2) {
        push('strategy:macro', 'Snowball early coherent : plusieurs champions forts des le debut.', 8);
      } else if (scalingLate === champions.length) {
        push('strategy:macro', 'Snowball choisi avec une comp qui scale tard : contradiction de plan.', -8);
      }
      break;
    case 'scaling':
      if (scalingLate >= 2) {
        push('strategy:macro', 'Scaling passif coherent : la comp devient dangereuse en fin de partie.', 8);
      } else if (scalingEarly === champions.length) {
        push('strategy:macro', 'Scaling choisi avec une comp forte tot puis vide : contradiction de plan.', -8);
      }
      break;
  }

  switch (selections.itemization) {
    case 'full-damage':
      if (ad > 0 && ap > 0) {
        push('strategy:itemization', 'Full degats coherent : mix AD/AP difficile a itemiser en face.', 6);
      } else if (tank === 0) {
        push('strategy:itemization', 'Full degats sans aucun tank : un seul bon engage adverse et c\'est fini.', -6);
      }
      break;
    case 'resistances':
      if (tank >= 2) {
        push('strategy:itemization', 'Full resistances coherent : la frontline peut absorber les fights.', 6);
      } else if (tank === 0) {
        push('strategy:itemization', 'Resistances choisies sans aucun tank a stack : plan hors sol.', -6);
      }
      break;
    case 'utility':
      if (totalCc >= 8 || disengage >= 1) {
        push('strategy:itemization', 'Build utilitaire coherent : de quoi peel et controler le fight.', 6);
      }
      break;
  }
}

/**
 * Moteur de scoring pur (aucune dependance NestJS/IO) : facile a tester
 * unitairement et a reutiliser tel quel si on branche un jour un autre
 * univers de "champions" (voir note IP dans ARCHITECTURE.md).
 *
 * Volontairement heuristique : l'objectif n'est pas une simulation fidele de
 * LoL mais un systeme simple, transparent (chaque facteur est explicable au
 * joueur) et suffisamment credible pour etre fun.
 */
export class DraftScoringEngine {
  static evaluate(
    champions: Champion[],
    budget: number,
    strategySelections?: StrategySelections,
  ): { totalScore: number; factors: DraftFactorBreakdown[] } {
    const factors: DraftFactorBreakdown[] = [];
    const push = (key: string, label: string, points: number) => {
      if (points !== 0) factors.push({ key, label, points });
    };

    // 1. Couverture des roles
    const coveredRoles = new Set<Role>();
    for (const champ of champions) {
      for (const role of champ.roles) coveredRoles.add(role);
    }
    const missingRoles = ALL_ROLES.filter((r) => !coveredRoles.has(r));
    if (missingRoles.length === 0) {
      push('roles', 'Composition complete : un champion capable de couvrir chaque role.', 15);
    } else {
      push('roles', `Roles non couverts : ${missingRoles.join(', ')}.`, -6 * missingRoles.length);
    }

    // 1bis. Sbires (unites gratuites) : filet de securite budgetaire, jamais competitif.
    const sbireCount = champions.filter((c) => c.rarity === 'gratuit').length;
    if (sbireCount > 0) {
      push(
        'sbire-filler',
        `${sbireCount} emplacement${sbireCount > 1 ? 's' : ''} comble${sbireCount > 1 ? 's' : ''} par un sbire gratuit : ca remplit l'equipe, mais ca n'apporte rien en combat.`,
        -9 * sbireCount,
      );
    }

    // 2. Frontline
    const tankCount = countByTag(champions, 'tank');
    if (tankCount === 0) {
      push('frontline', 'Aucun tank : l\'equipe va se faire percer des les premieres secondes.', -15);
    } else if (tankCount <= 2) {
      push('frontline', `Frontline solide (${tankCount} tank${tankCount > 1 ? 's' : ''}).`, 10);
    } else {
      push('frontline', 'Trop de frontline : pas assez de degats pour conclure les fights.', -5);
    }

    // 3. Mix AD/AP
    const adCount = countByTag(champions, 'ad');
    const apCount = countByTag(champions, 'ap');
    if (adCount === 0 || apCount === 0) {
      push('damage-mix', 'Tous les degats sont du meme type (AD ou AP) : facile a itemiser en face.', -10);
    } else if (Math.abs(adCount - apCount) <= 2) {
      push('damage-mix', `Mix AD/AP equilibre (${adCount} AD / ${apCount} AP) : dur a contrer avec une seule resistance.`, 10);
    }

    // 4. Engage / disengage
    const engageCount = countByTag(champions, 'engage');
    const disengageCount = countByTag(champions, 'disengage');
    if (engageCount === 0) {
      push('engage', 'Aucune capacite d\'engage : impossible d\'initier un combat dans de bonnes conditions.', -8);
    } else {
      push('engage', 'Capacite d\'engage presente pour initier les fights.', 8);
      if (disengageCount > 0) {
        push('versatility', 'Kit complet engage + disengage : polyvalence en teamfight.', 5);
      }
    }

    // 5. Controle de foule cumule
    const totalCc = champions.reduce((sum, c) => sum + c.ccScore, 0);
    if (totalCc >= 8) {
      push('cc', `Controle de foule massif (score cumule ${totalCc}).`, 10);
    } else if (totalCc <= 3) {
      push('cc', `Controle de foule quasi inexistant (score cumule ${totalCc}).`, -8);
    }

    // 6. Courbe de puissance (scaling)
    const early = countByTag(champions, 'scaling-early');
    const mid = countByTag(champions, 'scaling-mid');
    const late = countByTag(champions, 'scaling-late');
    if (late === champions.length) {
      push('scaling', 'Toute la composition scale tard : risque de perdre la partie avant d\'exister.', -8);
    } else if (early === champions.length) {
      push('scaling', 'Toute la composition est forte tot puis s\'eteint : il faut snowball vite.', -6);
    } else if (early > 0 && late > 0) {
      push('scaling', 'Courbe de puissance variee : la comp reste dangereuse a toutes les phases de jeu.', 6);
    }

    // 7. Surcharge d'assassins
    const assassinCount = countByTag(champions, 'assassin');
    if (assassinCount >= 4) {
      push('assassin-overload', 'Trop d\'assassins : zero peel, la moindre erreur coute tout le fight.', -25);
    } else if (assassinCount === 3) {
      push('assassin-overload', 'Beaucoup d\'assassins : composition fragile en teamfight prolonge.', -10);
    }

    // 8. Synergies specifiques
    for (let i = 0; i < champions.length; i++) {
      for (let j = i + 1; j < champions.length; j++) {
        const pair = [champions[i].id, champions[j].id];
        const rule = SYNERGY_RULES.find(
          (r) => (r.championIds[0] === pair[0] && r.championIds[1] === pair[1]) ||
                 (r.championIds[0] === pair[1] && r.championIds[1] === pair[0]),
        );
        if (rule) push(`synergy:${rule.championIds.join('-')}`, rule.label, rule.points);
      }
    }

    // 9. Utilisation du budget
    const spent = champions.reduce((sum, c) => sum + c.cost, 0);
    const ratio = budget > 0 ? spent / budget : 0;
    if (ratio >= 0.9) {
      push('budget', `Budget bien utilise (${spent}/${budget}).`, 4);
    } else if (ratio < 0.6) {
      push('budget', `Beaucoup de budget non depense (${spent}/${budget}) : la comp manque probablement de stats brutes.`, -4);
    }

    // 10. Choix strategiques (style de jeu, macro, itemisation)
    evaluateStrategy(champions, strategySelections, push);

    // 11. Identite d'equipe : bonus cumule (au-dela des bonus individuels ci-dessus)
    // quand les 3 categories pointent vers le MEME archetype ET que les tags de
    // la comp le confirment reellement (detectArchetype). Recompense une equipe
    // (bot ou humain) vraiment coherente sur toute la ligne, pas juste un pick isole.
    const archetype = detectArchetype(champions, strategySelections);
    if (archetype) {
      const alignment = ARCHETYPE_ALIGNMENT[archetype];
      if (
        strategySelections?.macro === alignment.macro &&
        strategySelections?.itemization === alignment.itemization
      ) {
        push(
          'team-identity',
          `Identite d'equipe totale (${archetype}) : chaque choix de strategie et chaque pick pointent dans la meme direction.`,
          15,
        );
      }
    }

    const totalScore = BASE_SCORE + factors.reduce((sum, f) => sum + f.points, 0);
    return { totalScore, factors };
  }
}
