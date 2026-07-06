import { Injectable } from '@nestjs/common';
import { CHAMPIONS, DEFAULT_DRAFT_BUDGET } from './data/champions.data';
import { STRATEGY_CATEGORIES } from './data/strategy-categories.data';
import { detectArchetype, DraftScoringEngine } from './engine/draft-scoring.engine';
import { PerksEngine } from './engine/perks.engine';
import { isCloneId, MatchEventRoll, pairRound } from './engine/tournament.engine';
import { MatchScenarioEngine } from './engine/match-scenario.engine';
import {
  Champion,
  DraftEvent,
  DraftFactorBreakdown,
  DraftMatchState,
  DraftResult,
  MatchScenario,
  Perk,
  PlaystyleArchetype,
  RoundMatchup,
  ScenarioSide,
  StrategySelections,
  TournamentProgress,
} from './interfaces/draft.interface';

const MAX_REROLLS = 3;
const REROLL_PENALTY = 5;
const MIN_TOURNAMENT_PLAYERS = 4;

/** Tres rare et aleatoire (voir demande produit) : ~10% budget illimite, ~3% legendaire only, ~1% mythique only. Tire INDEPENDAMMENT pour chaque match en tournoi (voir tournament.engine.ts::pairRound), une seule fois pour toute la partie en mode simple. */
const UNLIMITED_BUDGET_FOR_EVENT = 500;

function rollEvent(): DraftEvent | null {
  const roll = Math.random();
  if (roll < 0.01) return 'mythique-only';
  if (roll < 0.03) return 'legendaire-only';
  if (roll < 0.1) return 'budget-illimite';
  return null;
}

/** Valeurs acceptees pour forcer un event depuis le controle dev (voir room.component.ts) : 'none' force explicitement l'absence d'event plutot que de retomber sur le tirage aleatoire. */
export type ForcedDraftEvent = DraftEvent | 'none';
const FORCED_EVENT_VALUES: ForcedDraftEvent[] = ['mythique-only', 'legendaire-only', 'budget-illimite', 'none'];

function rollMatchEvent(baseBudget: number, forcedEvent?: ForcedDraftEvent | null): MatchEventRoll {
  const validForcedEvent = forcedEvent && FORCED_EVENT_VALUES.includes(forcedEvent) ? forcedEvent : null;
  const event = validForcedEvent ? (validForcedEvent === 'none' ? null : validForcedEvent) : rollEvent();
  return { budget: event ? UNLIMITED_BUDGET_FOR_EVENT : baseBudget, event };
}

interface DraftSubmission {
  championIds: string[];
  rerollsUsed: number;
  strategySelections: StrategySelections;
}

interface DraftEvaluation {
  playerId: string;
  championIds: string[];
  totalScore: number;
  factors: DraftFactorBreakdown[];
  perks: Perk[];
  archetype: PlaystyleArchetype | null;
}

interface SingleSession {
  mode: 'single';
  roomCode: string;
  budget: number;
  event: DraftEvent | null;
  /** Fige au lancement : un joueur qui rejoint la room en cours de manche n'en fait pas partie. */
  participants: string[];
  submissions: Map<string, DraftSubmission>;
}

/**
 * Session de tournoi round-par-round : `rounds[currentRound - 1]` est le seul
 * round "ouvert" au pick. Le round suivant n'existe pas tant que celui-ci
 * n'est pas entierement resolu (voir tryResolveRound/advanceRound) : pas de
 * resolution de bracket en un coup comme avant.
 *
 * Pas de `budget`/`event` global ici : chaque match (voir DraftMatchState) a
 * le sien, tire independamment (voir demande produit). `baseBudget` et
 * `forcedEvent` sont juste conserves pour pouvoir refaire un tirage coherent
 * a chaque nouveau round via advanceRound().
 */
interface TournamentSession {
  mode: 'tournament';
  roomCode: string;
  baseBudget: number;
  forcedEvent: ForcedDraftEvent | null;
  participants: string[];
  rounds: DraftMatchState[][];
  currentRound: number;
  /** playerId (reel) -> soumission de CE round. Reinitialise a chaque nouveau round. */
  roundSubmissions: Map<string, DraftSubmission>;
  finished: boolean;
  championId?: string;
}

type DraftSession = SingleSession | TournamentSession;

/**
 * Etat de draft en memoire, par room. Une session existe le temps d'une
 * manche de Draft Battle (simple ou tournoi) puis est nettoyee a la fin.
 */
@Injectable()
export class DraftService {
  private sessions = new Map<string, DraftSession>();

  getChampionsPool(): Champion[] {
    return CHAMPIONS;
  }

  /**
   * `forcedEvent` : uniquement pour le controle dev (voir room.component.ts)
   * qui permet de forcer un event plutot que d'attendre le tirage aleatoire
   * pour le tester visuellement. En tournoi, chaque match (chaque duel, a
   * chaque round) tire desormais SON PROPRE event independamment (voir
   * tournament.engine.ts::pairRound) : deux paires du meme round peuvent
   * tomber differemment, et le meme joueur peut retomber sur un event
   * different au round suivant. En mode simple (< 4 joueurs, pas de bracket)
   * un seul tirage vaut pour toute la partie puisqu'il n'y a qu'un seul "duel"
   * en tout et pour tout.
   */
  startDraft(
    roomCode: string,
    participants: string[],
    budget: number = DEFAULT_DRAFT_BUDGET,
    forcedEvent?: ForcedDraftEvent | null,
  ) {
    if (participants.length >= MIN_TOURNAMENT_PLAYERS) {
      this.sessions.set(roomCode, {
        mode: 'tournament',
        roomCode,
        baseBudget: budget,
        forcedEvent: forcedEvent ?? null,
        participants,
        rounds: [pairRound(participants, 1, () => rollMatchEvent(budget, forcedEvent))],
        currentRound: 1,
        roundSubmissions: new Map(),
        finished: false,
      });
      // Pas d'event/budget unique a annoncer pour tout le tournoi : chaque
      // joueur recoit celui de SON match via getRoundMatchup/getAllRoundMatchups.
      return { budget, championsPool: CHAMPIONS, strategyCategories: STRATEGY_CATEGORIES, event: null as DraftEvent | null };
    }
    const roll = rollMatchEvent(budget, forcedEvent);
    this.sessions.set(roomCode, {
      mode: 'single',
      roomCode,
      budget: roll.budget,
      event: roll.event,
      participants,
      submissions: new Map(),
    });
    return { budget: roll.budget, championsPool: CHAMPIONS, strategyCategories: STRATEGY_CATEGORIES, event: roll.event };
  }

  /** Etat courant pour un joueur qui rejoint la room pendant qu'une draft tourne deja. */
  getResyncState(roomCode: string) {
    const session = this.sessions.get(roomCode);
    if (!session) return undefined;
    // En tournoi, budget/event n'existent qu'au niveau du match (voir
    // getRoundMatchup) : ce resync ne renvoie que le budget de base, sans event
    // (le joueur recevra le vrai budget/event de son match via son matchup).
    return {
      budget: session.mode === 'single' ? session.budget : session.baseBudget,
      championsPool: CHAMPIONS,
      strategyCategories: STRATEGY_CATEGORIES,
      event: session.mode === 'single' ? session.event : null,
    };
  }

  isTournament(roomCode: string): boolean {
    return this.sessions.get(roomCode)?.mode === 'tournament';
  }

  getBracketProgress(roomCode: string): TournamentProgress | undefined {
    const session = this.sessions.get(roomCode);
    if (!session || session.mode !== 'tournament') return undefined;
    return {
      rounds: session.rounds.map((matches, i) => ({ round: i + 1, matches })),
      currentRound: session.currentRound,
      championId: session.championId,
    };
  }

  /** Toutes les "matchups" du round courant, a emettre a chaque joueur juste apres le pairing. */
  getAllRoundMatchups(roomCode: string): { playerId: string; matchup: RoundMatchup }[] {
    const session = this.sessions.get(roomCode);
    if (!session || session.mode !== 'tournament') return [];
    const round = session.rounds[session.currentRound - 1];
    const out: { playerId: string; matchup: RoundMatchup }[] = [];
    for (const match of round) {
      out.push({
        playerId: match.playerAId,
        matchup: {
          round: match.round,
          matchIndex: match.matchIndex,
          opponentId: match.playerBId,
          isCloneMatch: match.isCloneMatch,
          clonedFromPlayerId: match.clonedFromPlayerId,
          budget: match.budget,
          event: match.event,
        },
      });
      if (!match.isCloneMatch) {
        out.push({
          playerId: match.playerBId,
          matchup: {
            round: match.round,
            matchIndex: match.matchIndex,
            opponentId: match.playerAId,
            isCloneMatch: false,
            budget: match.budget,
            event: match.event,
          },
        });
      }
    }
    return out;
  }

  /** Le matchup du round courant pour un joueur donne (undefined si tournoi termine ou joueur elimine). */
  getRoundMatchup(roomCode: string, playerId: string): RoundMatchup | undefined {
    return this.getAllRoundMatchups(roomCode).find((m) => m.playerId === playerId)?.matchup;
  }

  submitPick(
    roomCode: string,
    playerId: string,
    championIds: string[],
    rerollsUsed = 0,
    strategySelections: StrategySelections = {},
  ): void {
    const session = this.sessions.get(roomCode);
    if (!session) throw new Error('Aucune draft en cours dans cette room.');
    if (!session.participants.includes(playerId)) {
      throw new Error('La draft a deja commence sans toi : tu rejoindras la prochaine manche.');
    }

    // En tournoi, le budget valide est celui du MATCH de ce joueur ce round
    // (voir DraftMatchState.budget), pas un budget de session unique.
    let budgetForValidation: number;
    if (session.mode === 'single') {
      budgetForValidation = session.budget;
    } else {
      const matchup = this.getRoundMatchup(roomCode, playerId);
      if (!matchup) throw new Error('Aucun match en cours pour toi ce round.');
      budgetForValidation = matchup.budget;
    }

    const submission = this.validateSubmission(championIds, rerollsUsed, strategySelections, budgetForValidation);

    if (session.mode === 'single') {
      session.submissions.set(playerId, submission);
      return;
    }
    if (session.finished) throw new Error('Le tournoi est deja termine.');
    session.roundSubmissions.set(playerId, submission);
  }

  private validateSubmission(
    championIds: string[],
    rerollsUsed: number,
    strategySelections: StrategySelections,
    budget: number,
  ): DraftSubmission {
    if (championIds.length !== 5) throw new Error('Une draft doit contenir exactement 5 champions.');
    const champions = championIds.map((id) => CHAMPIONS.find((c) => c.id === id));
    if (champions.some((c) => !c)) throw new Error('Champion inconnu dans la selection.');

    const spent = (champions as Champion[]).reduce((sum, c) => sum + c.cost, 0);
    if (spent > budget) throw new Error(`Budget depasse (${spent}/${budget}).`);

    const cleanSelections: StrategySelections = {};
    for (const category of STRATEGY_CATEGORIES) {
      const chosen = strategySelections[category.id];
      if (chosen && category.options.some((o) => o.id === chosen)) cleanSelections[category.id] = chosen;
    }

    return {
      championIds,
      rerollsUsed: Math.max(0, Math.min(MAX_REROLLS, Math.round(rerollsUsed))),
      strategySelections: cleanSelections,
    };
  }

  // ---- mode "single" (< 4 joueurs, sans bracket) : logique inchangee ----

  allSubmitted(roomCode: string, connectedPlayerIds: string[]): boolean {
    const session = this.sessions.get(roomCode);
    if (!session || session.mode !== 'single') return false;
    const stillExpected = session.participants.filter((id) => connectedPlayerIds.includes(id));
    return stillExpected.length > 0 && stillExpected.every((id) => session.submissions.has(id));
  }

  computeResults(roomCode: string): { results: DraftResult[] } {
    const session = this.sessions.get(roomCode);
    if (!session || session.mode !== 'single') throw new Error('Aucune draft en cours dans cette room.');

    const evaluations = Array.from(session.submissions.entries()).map(([playerId, submission]) =>
      this.evaluate(playerId, submission, session.budget),
    );
    const maxScore = Math.max(...evaluations.map((e) => e.totalScore));
    const results: DraftResult[] = evaluations.map((e) => ({
      playerId: e.playerId,
      totalScore: e.totalScore,
      championIds: e.championIds,
      factors: e.factors,
      isWinner: e.totalScore === maxScore,
      perks: e.perks,
    }));

    if (evaluations.length >= 2) {
      const [top, runnerUp] = [...evaluations].sort((a, b) => b.totalScore - a.totalScore);
      const scenario = this.buildMatchScenario(`${roomCode}:single`, top, runnerUp, top.playerId);
      for (const r of results) {
        if (r.playerId === top.playerId) {
          r.scenario = scenario;
          r.scenarioSide = 'A';
        } else if (r.playerId === runnerUp.playerId) {
          r.scenario = scenario;
          r.scenarioSide = 'B';
        }
      }
    }

    this.sessions.delete(roomCode);
    return { results };
  }

  toRoundScoresSingle(results: DraftResult[]): Record<string, number> {
    const scores: Record<string, number> = {};
    for (const r of results) scores[r.playerId] = r.isWinner ? 10 : Math.max(0, Math.round(r.totalScore / 10));
    return scores;
  }

  // ---- mode "tournament" (4+ joueurs) : bracket round-par-round ----

  /** A appeler juste apres submitPick en mode tournoi : resout les matchs desormais prets, avance le round si complet. */
  tryResolveRound(
    roomCode: string,
  ): { resolvedMatches: DraftMatchState[]; roundJustCompleted: boolean; tournamentFinished: boolean } {
    const session = this.sessions.get(roomCode);
    if (!session || session.mode !== 'tournament') {
      return { resolvedMatches: [], roundJustCompleted: false, tournamentFinished: false };
    }

    const round = session.rounds[session.currentRound - 1];
    const resolvedMatches: DraftMatchState[] = [];

    for (const match of round) {
      if (match.status === 'resolved') continue;
      const subA = session.roundSubmissions.get(match.playerAId);
      const subB = match.isCloneMatch
        ? session.roundSubmissions.get(match.clonedFromPlayerId!)
        : session.roundSubmissions.get(match.playerBId);
      if (!subA || !subB) continue;

      // Budget du MATCH (voir DraftMatchState.budget), pas un budget de session unique.
      const evalA = this.evaluate(match.playerAId, subA, match.budget);
      const evalB = this.evaluate(match.playerBId, subB, match.budget);
      const winnerId =
        evalA.totalScore === evalB.totalScore
          ? [match.playerAId, match.playerBId][Math.round(Math.random())]
          : evalA.totalScore > evalB.totalScore
            ? match.playerAId
            : match.playerBId;

      match.status = 'resolved';
      match.winnerId = winnerId;
      match.scenario = this.buildMatchScenario(`${roomCode}:${match.round}:${match.matchIndex}`, evalA, evalB, winnerId);
      resolvedMatches.push(match);
    }

    const roundJustCompleted = resolvedMatches.length > 0 && round.every((m) => m.status === 'resolved');
    let tournamentFinished = false;
    if (roundJustCompleted) tournamentFinished = this.advanceRound(session);

    return { resolvedMatches, roundJustCompleted, tournamentFinished };
  }

  private advanceRound(session: TournamentSession): boolean {
    const round = session.rounds[session.currentRound - 1];
    const winners = round.filter((m) => m.winnerId && !isCloneId(m.winnerId)).map((m) => m.winnerId!);

    if (winners.length <= 1) {
      session.finished = true;
      session.championId = winners[0] ?? round.find((m) => !m.isCloneMatch)?.playerAId;
      return true;
    }

    session.currentRound += 1;
    session.roundSubmissions = new Map();
    // Nouveau tirage independant par match pour ce nouveau round (voir
    // pairRound) : le forcedEvent dev reste applique a tous si toujours actif,
    // sinon chaque duel de ce round retire au hasard independamment des autres.
    session.rounds.push(
      pairRound(winners, session.currentRound, () => rollMatchEvent(session.baseBudget, session.forcedEvent)),
    );
    return false;
  }

  /** Une fois le tournoi termine : scores (nombre de victoires par joueur) pour le score general de la room. Appele une seule fois. */
  finalizeTournament(
    roomCode: string,
  ): { progress: TournamentProgress; scores: Record<string, number>; championId: string } | undefined {
    const session = this.sessions.get(roomCode);
    if (!session || session.mode !== 'tournament' || !session.finished || !session.championId) return undefined;

    const winsByPlayer = new Map<string, number>();
    for (const round of session.rounds) {
      for (const match of round) {
        if (match.winnerId && !isCloneId(match.winnerId)) {
          winsByPlayer.set(match.winnerId, (winsByPlayer.get(match.winnerId) ?? 0) + 1);
        }
      }
    }

    const scores: Record<string, number> = {};
    for (const playerId of session.participants) {
      const wins = winsByPlayer.get(playerId) ?? 0;
      scores[playerId] = playerId === session.championId ? 100 : Math.max(5, wins * 20);
    }

    const progress = this.getBracketProgress(roomCode)!;
    const championId = session.championId;
    this.sessions.delete(roomCode);
    return { progress, scores, championId };
  }

  private evaluate(playerId: string, submission: DraftSubmission, budget: number): DraftEvaluation {
    const champions = submission.championIds.map((id) => CHAMPIONS.find((c) => c.id === id)!);
    const { totalScore, factors } = DraftScoringEngine.evaluate(champions, budget, submission.strategySelections);
    const { perks, bonusPoints } = PerksEngine.detect(champions, submission.strategySelections);
    const archetype = detectArchetype(champions, submission.strategySelections);
    const rerollPenalty = submission.rerollsUsed * REROLL_PENALTY;
    const penalizedFactors = rerollPenalty
      ? [...factors, { key: 'reroll-penalty', label: `Reroll x${submission.rerollsUsed}`, points: -rerollPenalty }]
      : factors;
    return {
      playerId,
      championIds: submission.championIds,
      totalScore: Math.max(0, totalScore - rerollPenalty + bonusPoints),
      factors: penalizedFactors,
      perks,
      archetype,
    };
  }

  private buildMatchScenario(seed: string, evalA: DraftEvaluation, evalB: DraftEvaluation, winnerId: string): MatchScenario {
    const winnerSide: ScenarioSide = winnerId === evalA.playerId ? 'A' : 'B';
    return MatchScenarioEngine.generate({
      matchSeed: seed,
      teamA: {
        playerId: evalA.playerId,
        champions: evalA.championIds.map((id) => CHAMPIONS.find((c) => c.id === id)!),
        factors: evalA.factors,
        archetype: evalA.archetype,
      },
      teamB: {
        playerId: evalB.playerId,
        champions: evalB.championIds.map((id) => CHAMPIONS.find((c) => c.id === id)!),
        factors: evalB.factors,
        archetype: evalB.archetype,
      },
      winnerSide,
    });
  }
}
