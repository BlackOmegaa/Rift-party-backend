export interface CroquisPlayerRef {
	id: string;
	pseudo: string;
}

/** Entree de la galerie : snapshot pris a la fin de la phase dessin (survit au depart de l'artiste). `image` null = l'artiste n'a pas rendu de dessin a temps (garde quand meme sa place dans la galerie). */
export interface CroquisGalleryEntry {
	artistId: string;
	artistPseudo: string;
	champion: string;
	image: string | null;
}

/** Ce que voit la room pendant qu'un dessin est a deviner (champion masque). */
export interface CroquisGalleryItem {
	artistId: string;
	artistPseudo: string;
	image: string | null;
	index: number;
	total: number;
	deadline: number;
}

export interface CroquisReveal {
	artistId: string;
	artistPseudo: string;
	champion: string;
	image: string | null;
	guesses: { playerId: string; pseudo: string; guess: string; correct: boolean }[];
	roundPoints: Record<string, number>;
	totalScores: Record<string, number>;
	isLast: boolean;
}

export interface CroquisResult {
	rows: { playerId: string; pseudo: string; points: number }[];
	scores: Record<string, number>;
	summary: string;
}

export interface CroquisSnapshot {
	active: boolean;
	phase: 'drawing' | 'guessing' | 'reveal' | 'results';
	myChampion: string | null;
	drawingDeadline: number | null;
	mySubmitted: boolean;
	submittedCount: number;
	expectedCount: number;
	item: CroquisGalleryItem | null;
	myGuess: string | null;
	guessedCount: number;
	guessExpectedCount: number;
	lastReveal: CroquisReveal | null;
	results: CroquisResult | null;
}
