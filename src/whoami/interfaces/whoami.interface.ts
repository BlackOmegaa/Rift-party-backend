export interface WhoamiPlayerRef {
	id: string;
	pseudo: string;
}

/** Vue d'un joueur pour un client donne : son champion est masque (null) pour lui-meme tant qu'il ne l'a pas trouve. */
export interface WhoamiAssignmentView {
	playerId: string;
	pseudo: string;
	champion: string | null;
	found: boolean;
	failed: boolean;
	questionsUsed: number;
	points: number;
}

/** Etat public du tour courant, diffuse a toute la room apres chaque transition. */
export interface WhoamiTurnState {
	activePlayerId: string;
	activePseudo: string;
	phase: 'answering' | 'decision';
	deadline: number;
	questionsUsed: number;
	/** Verdict de la derniere question du joueur actif (null au debut d'une question). */
	lastQuestion: { yes: number; no: number; verdict: 'oui' | 'non' | 'egalite' } | null;
	/** False quand le verdict est NON/egalite : le tour passera apres la decision. */
	canContinue: boolean;
	/** True quand le joueur actif a epuise ses questions : il doit deviner (quitte a se tromper et sortir). */
	mustGuess: boolean;
}

export interface WhoamiGuessResult {
	playerId: string;
	pseudo: string;
	guess: string;
	correct: boolean;
	/** Champion reel, revele uniquement si trouve (ou en fin de partie via results). */
	actualChampion: string | null;
	points: number;
	eliminated: boolean;
}

export interface WhoamiResult {
	rows: { playerId: string; pseudo: string; champion: string; found: boolean; questionsUsed: number; points: number }[];
	scores: Record<string, number>;
	summary: string;
}

export interface WhoamiSnapshot {
	active: boolean;
	assignments: WhoamiAssignmentView[];
	turn: WhoamiTurnState | null;
	myAnswered: boolean;
	answeredCount: number;
	expectedCount: number;
	lastGuess: WhoamiGuessResult | null;
	results: WhoamiResult | null;
}
