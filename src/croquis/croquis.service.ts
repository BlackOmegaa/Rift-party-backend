import { Injectable } from '@nestjs/common';
import { CHAMPIONS } from '../draft/data/champions.data';
import {
	CroquisGalleryEntry,
	CroquisGalleryItem,
	CroquisPlayerRef,
	CroquisResult,
	CroquisReveal,
	CroquisSnapshot,
} from './interfaces/croquis.interface';

/** Phase dessin : plus longue que le timer de manche classique, dessiner prend du temps. */
const DRAWING_TIME_SEC = 90;
/** Filet de securite : si l'host ne fait pas avancer le reveal, le serveur avance tout seul. */
const REVEAL_SAFETY_TIME_SEC = 90;
const GUESSER_POINTS = 10;
const ARTIST_POINTS_PER_CORRECT = 5;
/** Garde-fou taille d'un PNG base64 (socket.io coupe a 1 Mo par defaut). */
const MAX_IMAGE_LENGTH = 900_000;

interface CroquisPlayerState {
	id: string;
	pseudo: string;
	champion: string;
	image: string | null;
}

interface CroquisSession {
	roomCode: string;
	players: CroquisPlayerState[];
	phase: 'drawing' | 'guessing' | 'reveal' | 'results';
	gallery: CroquisGalleryEntry[];
	galleryIndex: number;
	/** voterId -> nom de champion propose pour le dessin courant. */
	guesses: Map<string, string>;
	totalScores: Record<string, number>;
	lastReveal: CroquisReveal | null;
	deadline: number;
	roundTimeSec: number;
	phaseTimeout?: NodeJS.Timeout;
	onTimeout: (roomCode: string) => void;
}

function normalize(name: string): string {
	return name
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z]/g, '');
}

function shuffle<T>(arr: T[]): T[] {
	const copy = [...arr];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

/**
 * Etat "Croquis" en memoire, par room. Deroulement : tout le monde dessine SON
 * champion secret en simultane, puis les dessins passent un par un devant le
 * lobby qui devine. Le dessinateur marque quand on trouve son dessin, les
 * devineurs marquent quand ils trouvent. Meme convention de session que les
 * autres mini-jeux a gateway.
 */
@Injectable()
export class CroquisService {
	private sessions = new Map<string, CroquisSession>();
	private lastResults = new Map<string, CroquisResult>();

	startSession(
		roomCode: string,
		players: CroquisPlayerRef[],
		roundTimeSec: number,
		onTimeout: (roomCode: string) => void,
	): { drawingTimeSec: number; deadline: number } {
		this.clearSession(roomCode);
		this.lastResults.delete(roomCode);

		const pool = shuffle(CHAMPIONS.filter((c) => c.rarity !== 'gratuit').map((c) => c.name));
		const states: CroquisPlayerState[] = players.map((p, i) => ({
			id: p.id,
			pseudo: p.pseudo,
			champion: pool[i % pool.length],
			image: null,
		}));

		const session: CroquisSession = {
			roomCode,
			players: states,
			phase: 'drawing',
			gallery: [],
			galleryIndex: 0,
			guesses: new Map(),
			totalScores: Object.fromEntries(players.map((p) => [p.id, 0])),
			lastReveal: null,
			deadline: Date.now() + DRAWING_TIME_SEC * 1000,
			roundTimeSec,
			onTimeout,
		};
		session.phaseTimeout = setTimeout(() => onTimeout(roomCode), DRAWING_TIME_SEC * 1000);
		this.sessions.set(roomCode, session);

		return { drawingTimeSec: DRAWING_TIME_SEC, deadline: session.deadline };
	}

	phaseOf(roomCode: string): CroquisSession['phase'] | undefined {
		return this.sessions.get(roomCode)?.phase;
	}

	championOf(roomCode: string, playerId: string): string | null {
		return this.sessions.get(roomCode)?.players.find((p) => p.id === playerId)?.champion ?? null;
	}

	getPlayers(roomCode: string): CroquisPlayerRef[] {
		return (this.sessions.get(roomCode)?.players ?? []).map((p) => ({ id: p.id, pseudo: p.pseudo }));
	}

	/** Reception du dessin d'un joueur (une seule fois, phase dessin uniquement). */
	submitDrawing(
		roomCode: string,
		playerId: string,
		image: string,
	): { submittedCount: number; expectedCount: number; allSubmitted: boolean } {
		const session = this.sessions.get(roomCode);
		if (!session || session.phase !== 'drawing') throw new Error("Ce n'est pas la phase de dessin.");
		const player = session.players.find((p) => p.id === playerId);
		if (!player) throw new Error('Tu ne fais pas partie de cette partie.');
		if (player.image) throw new Error('Ton dessin est deja envoye.');
		if (!image.startsWith('data:image/png;base64,') || image.length > MAX_IMAGE_LENGTH) {
			throw new Error('Dessin invalide ou trop lourd.');
		}

		player.image = image;
		return this.drawingProgress(session);
	}

	/** Cloture la phase dessin et ouvre la galerie (dessins manquants ignores). Renvoie null si aucun dessin. */
	startGallery(roomCode: string): CroquisGalleryItem | null {
		const session = this.sessions.get(roomCode);
		if (!session) throw new Error('Aucune partie Croquis en cours.');
		if (session.phaseTimeout) clearTimeout(session.phaseTimeout);

		session.gallery = shuffle(
			session.players
				.filter((p) => p.image)
				.map((p) => ({ artistId: p.id, artistPseudo: p.pseudo, champion: p.champion, image: p.image! })),
		);
		if (!session.gallery.length) return null;

		session.galleryIndex = 0;
		this.openGuessing(session);
		return this.currentItem(session);
	}

	/** Proposition d'un devineur pour le dessin courant (l'artiste ne devine pas le sien). */
	submitGuess(
		roomCode: string,
		voterId: string,
		guess: string,
	): { guessedCount: number; expectedCount: number; allGuessed: boolean } {
		const session = this.sessions.get(roomCode);
		if (!session || session.phase !== 'guessing') throw new Error("Ce n'est pas la phase de devinette.");
		const entry = session.gallery[session.galleryIndex];
		if (voterId === entry.artistId) throw new Error('On ne devine pas son propre dessin.');
		if (!session.players.some((p) => p.id === voterId)) throw new Error('Tu ne fais pas partie de cette partie.');
		if (session.guesses.has(voterId)) throw new Error('Tu as deja propose un champion pour ce dessin.');
		if (!guess.trim()) throw new Error('Proposition vide.');

		session.guesses.set(voterId, guess.trim());
		return this.guessProgress(session);
	}

	/** Cloture les devinettes du dessin courant : calcule points devineurs + artiste. */
	revealCurrent(roomCode: string): CroquisReveal {
		const session = this.sessions.get(roomCode);
		if (!session) throw new Error('Aucune partie Croquis en cours.');
		if (session.phaseTimeout) clearTimeout(session.phaseTimeout);
		session.phase = 'reveal';

		const entry = session.gallery[session.galleryIndex];
		const pseudoOf = (id: string) => session.players.find((p) => p.id === id)?.pseudo ?? 'Joueur';
		const target = normalize(entry.champion);

		const guesses = [...session.guesses.entries()].map(([playerId, guess]) => ({
			playerId,
			pseudo: pseudoOf(playerId),
			guess,
			correct: normalize(guess) === target,
		}));
		const correctCount = guesses.filter((g) => g.correct).length;

		const roundPoints: Record<string, number> = Object.fromEntries(session.players.map((p) => [p.id, 0]));
		for (const g of guesses) {
			if (g.correct) roundPoints[g.playerId] = (roundPoints[g.playerId] ?? 0) + GUESSER_POINTS;
		}
		if (correctCount > 0 && roundPoints[entry.artistId] !== undefined) {
			roundPoints[entry.artistId] += ARTIST_POINTS_PER_CORRECT * correctCount;
		}
		for (const [playerId, pts] of Object.entries(roundPoints)) {
			session.totalScores[playerId] = (session.totalScores[playerId] ?? 0) + pts;
		}

		const reveal: CroquisReveal = {
			artistId: entry.artistId,
			artistPseudo: entry.artistPseudo,
			champion: entry.champion,
			image: entry.image,
			guesses,
			roundPoints,
			totalScores: { ...session.totalScores },
			isLast: session.galleryIndex + 1 >= session.gallery.length,
		};
		session.lastReveal = reveal;
		// Filet de securite : le reveal n'est avance que par l'host ; si son client
		// ne suit plus, le serveur avance a sa place au bout du delai (via le
		// handleTimeout du gateway, qui dispatch selon la phase).
		session.phaseTimeout = setTimeout(() => session.onTimeout(session.roomCode), REVEAL_SAFETY_TIME_SEC * 1000);
		return reveal;
	}

	isLastDrawing(roomCode: string): boolean {
		const session = this.sessions.get(roomCode);
		return !session || session.galleryIndex + 1 >= session.gallery.length;
	}

	/** Vrai si le dessin courant n'attend aucun devineur (session reduite a l'artiste seul). */
	noGuesserExpected(roomCode: string): boolean {
		const session = this.sessions.get(roomCode);
		if (!session || session.phase !== 'guessing') return false;
		return this.guessProgress(session).expectedCount === 0;
	}

	/** Passe au dessin suivant (phase reveal uniquement, appele par l'host). */
	nextDrawing(roomCode: string): CroquisGalleryItem {
		const session = this.sessions.get(roomCode);
		if (!session || session.phase !== 'reveal') throw new Error("Ce n'est pas le moment.");
		if (this.isLastDrawing(roomCode)) throw new Error('Tous les dessins sont passes.');

		session.galleryIndex += 1;
		this.openGuessing(session);
		return this.currentItem(session);
	}

	computeResults(roomCode: string): CroquisResult {
		const session = this.sessions.get(roomCode);
		if (!session) throw new Error('Aucune partie Croquis en cours.');
		if (session.phaseTimeout) clearTimeout(session.phaseTimeout);

		const rows = session.players
			.map((p) => ({ playerId: p.id, pseudo: p.pseudo, points: session.totalScores[p.id] ?? 0 }))
			.sort((a, b) => b.points - a.points);
		const scores: Record<string, number> = {};
		for (const row of rows) scores[row.playerId] = row.points;
		const summary = rows.length
			? `${rows[0].pseudo} remporte l'atelier croquis avec ${rows[0].points} pts.`
			: 'Atelier croquis termine.';

		const result: CroquisResult = { rows, scores, summary };
		this.lastResults.set(roomCode, result);
		this.sessions.delete(roomCode);
		return result;
	}

	/** Retire un joueur parti : ses dessins deja en galerie restent (snapshot). */
	removePlayer(
		roomCode: string,
		playerId: string,
	): { allSubmitted?: boolean; allGuessed?: boolean } | undefined {
		const session = this.sessions.get(roomCode);
		if (!session) return undefined;
		const before = session.players.length;
		session.players = session.players.filter((p) => p.id !== playerId);
		session.guesses.delete(playerId);
		if (session.players.length === before) return undefined;
		if (!session.players.length) {
			this.clearSession(roomCode);
			return {};
		}
		if (session.phase === 'drawing') {
			return { allSubmitted: this.drawingProgress(session).allSubmitted };
		}
		if (session.phase === 'guessing') {
			return { allGuessed: this.guessProgress(session).allGuessed };
		}
		return {};
	}

	getSnapshot(roomCode: string, viewerId: string): CroquisSnapshot {
		const session = this.sessions.get(roomCode);
		if (!session) {
			return {
				active: false,
				phase: 'results',
				myChampion: null,
				drawingDeadline: null,
				mySubmitted: false,
				submittedCount: 0,
				expectedCount: 0,
				item: null,
				myGuess: null,
				guessedCount: 0,
				guessExpectedCount: 0,
				lastReveal: null,
				results: this.lastResults.get(roomCode) ?? null,
			};
		}
		const me = session.players.find((p) => p.id === viewerId);
		const drawing = this.drawingProgress(session);
		const guessing = session.phase === 'guessing' || session.phase === 'reveal' ? this.guessProgress(session) : null;
		return {
			active: true,
			phase: session.phase,
			myChampion: me?.champion ?? null,
			drawingDeadline: session.phase === 'drawing' ? session.deadline : null,
			mySubmitted: !!me?.image,
			submittedCount: drawing.submittedCount,
			expectedCount: drawing.expectedCount,
			item: session.phase === 'guessing' ? this.currentItem(session) : null,
			myGuess: session.guesses.get(viewerId) ?? null,
			guessedCount: guessing?.guessedCount ?? 0,
			guessExpectedCount: guessing?.expectedCount ?? 0,
			lastReveal: session.phase === 'reveal' ? session.lastReveal : null,
			results: null,
		};
	}

	/** Nettoyage complet a la fermeture de la room : timers + session + dernier resultat. */
	clearRoom(roomCode: string): void {
		this.clearSession(roomCode);
		this.lastResults.delete(roomCode);
	}

	private currentItem(session: CroquisSession): CroquisGalleryItem {
		const entry = session.gallery[session.galleryIndex];
		return {
			artistId: entry.artistId,
			artistPseudo: entry.artistPseudo,
			image: entry.image,
			index: session.galleryIndex + 1,
			total: session.gallery.length,
			deadline: session.deadline,
		};
	}

	private openGuessing(session: CroquisSession): void {
		session.phase = 'guessing';
		session.guesses = new Map();
		session.lastReveal = null;
		if (session.phaseTimeout) clearTimeout(session.phaseTimeout);
		session.deadline = Date.now() + session.roundTimeSec * 1000;
		session.phaseTimeout = setTimeout(() => session.onTimeout(session.roomCode), session.roundTimeSec * 1000);
	}

	private drawingProgress(session: CroquisSession): { submittedCount: number; expectedCount: number; allSubmitted: boolean } {
		const submittedCount = session.players.filter((p) => p.image).length;
		const expectedCount = session.players.length;
		return { submittedCount, expectedCount, allSubmitted: submittedCount >= expectedCount };
	}

	private guessProgress(session: CroquisSession): { guessedCount: number; expectedCount: number; allGuessed: boolean } {
		const entry = session.gallery[session.galleryIndex];
		const expectedCount = session.players.filter((p) => p.id !== entry.artistId).length;
		const guessedCount = session.guesses.size;
		return { guessedCount, expectedCount, allGuessed: guessedCount >= expectedCount };
	}

	private clearSession(roomCode: string): void {
		const existing = this.sessions.get(roomCode);
		if (existing?.phaseTimeout) clearTimeout(existing.phaseTimeout);
		this.sessions.delete(roomCode);
	}
}
