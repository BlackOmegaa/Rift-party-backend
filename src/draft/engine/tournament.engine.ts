import { DraftEvent, DraftMatchState } from '../interfaces/draft.interface';

export interface MatchEventRoll {
  budget: number;
  event: DraftEvent | null;
}

export const CLONE_PREFIX = 'clone:';

/** Construit l'id synthetique d'un clone : encode le joueur clone dedans pour que l'affichage ("Clone de X") n'ait besoin d'aucune donnee supplementaire. */
export function makeCloneId(clonedFromPlayerId: string, round: number, matchIndex: number): string {
  return `${CLONE_PREFIX}${clonedFromPlayerId}:${round}:${matchIndex}`;
}

export function isCloneId(id: string): boolean {
  return id.startsWith(CLONE_PREFIX);
}

/** Extrait le vrai joueur clone a partir d'un id synthetique (voir makeCloneId). */
export function cloneSourceOf(id: string): string | undefined {
  if (!isCloneId(id)) return undefined;
  return id.slice(CLONE_PREFIX.length).split(':')[0];
}

/**
 * Genere les matchs d'un round a partir de la liste des joueurs encore en
 * lice. Nombre pair : appariement simple. Nombre impair : un joueur tombe
 * seul et affronte un clone (copie de la draft) d'un autre joueur choisi au
 * hasard parmi le reste du round — jamais un bye gratuit, et si le clone
 * gagne ca n'affecte en rien le vrai match du joueur clone (voir
 * DraftMatchState). Pas de dependance NestJS/IO : facile a tester seul.
 *
 * `rollMatchEvent` est appele UNE FOIS PAR VRAI MATCH (voir demande produit :
 * l'event special doit etre tire independamment pour chaque duel, pas une
 * seule fois pour tout le tournoi) : deux paires du meme round peuvent tomber
 * sur des events differents, et le meme joueur peut retomber sur un event
 * different au round suivant. Le match clone ne tire rien lui-meme : il
 * reprend le budget/event du match reel de son `clonedFromPlayerId` (meme
 * round), puisqu'il rejoue la meme soumission plutot que d'en tirer une
 * nouvelle.
 */
export function pairRound(
  playerIds: string[],
  round: number,
  rollMatchEvent: () => MatchEventRoll,
): DraftMatchState[] {
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
  const matches: DraftMatchState[] = [];
  let matchIndex = 0;

  let pool = shuffled;
  let cloneSource: string | undefined;
  let cloneMatchIndex: number | undefined;
  let unpaired: string | undefined;
  if (shuffled.length % 2 !== 0) {
    unpaired = shuffled[shuffled.length - 1];
    pool = shuffled.slice(0, -1);
    cloneSource = pool[Math.floor(Math.random() * pool.length)];
    cloneMatchIndex = Math.floor(pool.length / 2);
  }

  for (let i = 0; i < pool.length; i += 2) {
    const roll = rollMatchEvent();
    matches.push({
      round,
      matchIndex,
      playerAId: pool[i],
      playerBId: pool[i + 1],
      isCloneMatch: false,
      status: 'drafting',
      budget: roll.budget,
      event: roll.event,
    });
    matchIndex++;
  }

  if (unpaired !== undefined && cloneSource !== undefined && cloneMatchIndex !== undefined) {
    // Reprend le budget/event du match reel du joueur clone (meme round) :
    // ce match reutilise sa soumission telle quelle, jamais une nouvelle.
    const sourceMatch = matches.find((m) => m.playerAId === cloneSource || m.playerBId === cloneSource);
    matches.push({
      round,
      matchIndex: cloneMatchIndex,
      playerAId: unpaired,
      playerBId: makeCloneId(cloneSource, round, cloneMatchIndex),
      isCloneMatch: true,
      clonedFromPlayerId: cloneSource,
      status: 'drafting',
      budget: sourceMatch?.budget ?? rollMatchEvent().budget,
      event: sourceMatch?.event ?? null,
    });
  }

  return matches.sort((a, b) => a.matchIndex - b.matchIndex);
}
