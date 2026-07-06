import { LastSurvivorCandidate } from '../data/last-survivor-categories.data';

export interface LastSurvivorPlayerRef {
	id: string;
	pseudo: string;
}

/** Decompte public d'un candidat apres reveal : combien de voix pour son elimination, et de qui. */
export interface LastSurvivorTally {
	label: string;
	champion: string;
	votes: number;
	voters: { playerId: string; pseudo: string }[];
}

export interface LastSurvivorRoundResult {
	category: string;
	roundNumber: number;
	totalRounds: number;
	tallies: LastSurvivorTally[];
	eliminated: LastSurvivorCandidate;
	/** True si l'elimine a ete tire au sort parmi des ex aequo (ou zero vote). */
	tieBreak: boolean;
	remaining: LastSurvivorCandidate[];
	/** Points gagnes sur CETTE manche uniquement. */
	roundPoints: Record<string, number>;
	/** Scores cumules depuis le debut de la session. */
	totalScores: Record<string, number>;
}

export interface LastSurvivorResult {
	category: string;
	winner: LastSurvivorCandidate;
	rows: { playerId: string; pseudo: string; points: number }[];
	scores: Record<string, number>;
	summary: string;
}

export interface LastSurvivorSnapshot {
	active: boolean;
	phase: 'voting' | 'reveal' | 'results';
	category: string | null;
	candidates: LastSurvivorCandidate[];
	roundNumber: number;
	totalRounds: number;
	deadline: number | null;
	myVote: string | null;
	votedCount: number;
	expectedCount: number;
	lastRound: LastSurvivorRoundResult | null;
	results: LastSurvivorResult | null;
}
