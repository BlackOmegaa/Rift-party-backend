export interface VotePartyPlayerRef {
	id: string;
	pseudo: string;
}

/** Decompte public d'une cible apres reveal : qui a recolte combien de voix, et de qui. */
export interface VotePartyTally {
	playerId: string;
	pseudo: string;
	votes: number;
	voters: { playerId: string; pseudo: string }[];
}

export interface VotePartyRoundResult {
	question: string;
	roundNumber: number;
	totalRounds: number;
	tallies: VotePartyTally[];
	/** Cibles ayant recu le plus de voix (plusieurs en cas d'egalite). */
	electedIds: string[];
	/** Points gagnes sur CETTE manche uniquement. */
	roundPoints: Record<string, number>;
	/** Scores cumules depuis le debut de la session. */
	totalScores: Record<string, number>;
}

export interface VotePartyResult {
	rows: { playerId: string; pseudo: string; points: number }[];
	scores: Record<string, number>;
	summary: string;
}

export interface VotePartySnapshot {
	active: boolean;
	phase: 'voting' | 'reveal' | 'results';
	question: string | null;
	roundNumber: number;
	totalRounds: number;
	deadline: number | null;
	myVote: string | null;
	votedCount: number;
	expectedCount: number;
	lastRound: VotePartyRoundResult | null;
	results: VotePartyResult | null;
}
