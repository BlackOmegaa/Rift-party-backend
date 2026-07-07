import { Injectable } from '@nestjs/common';
import { CHAMPIONS } from '../draft/data/champions.data';
import {
	WhoamiAssignmentView,
	WhoamiGuessResult,
	WhoamiPlayerRef,
	WhoamiResult,
	WhoamiSnapshot,
	WhoamiTurnState,
} from './interfaces/whoami.interface';

/** Au-dela de ce nombre de questions repondues, le joueur actif doit deviner (rate = elimine). */
const MAX_QUESTIONS = 12;
const BASE_POINTS = 60;
const QUESTION_COST = 5;
const WRONG_GUESS_COST = 10;
const MIN_WIN_POINTS = 10;

interface WhoamiPlayerState {
	id: string;
	pseudo: string;
	champion: string;
	found: boolean;
	failed: boolean;
	questionsUsed: number;
	wrongGuesses: number;
	points: number;
}

interface WhoamiSession {
	roomCode: string;
	players: WhoamiPlayerState[];
	activeIndex: number;
	phase: 'answering' | 'decision';
	/** Reponses Oui/Non de la question en cours (voterId -> valeur). */
	answers: Map<string, boolean>;
	lastQuestion: { yes: number; no: number; verdict: 'oui' | 'non' | 'egalite' } | null;
	lastGuess: WhoamiGuessResult | null;
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
 * Etat "Qui suis-je ?" en memoire, par room. Meme convention que les autres
 * mini-jeux a gateway (une session par room, nettoyee dans computeResults).
 *
 * Deroulement d'un tour : le joueur actif pose sa question A VOIX HAUTE (jamais
 * saisie dans l'app), les autres repondent Oui/Non dans l'app, le verdict
 * majoritaire s'affiche. Verdict OUI : il peut enchainer une autre question.
 * Verdict NON/egalite : il peut tenter de deviner, sinon son tour passe.
 */
@Injectable()
export class WhoamiService {
	private sessions = new Map<string, WhoamiSession>();
	private lastResults = new Map<string, WhoamiResult>();

	startSession(
		roomCode: string,
		players: WhoamiPlayerRef[],
		roundTimeSec: number,
		onTimeout: (roomCode: string) => void,
	): void {
		this.clearSession(roomCode);
		this.lastResults.delete(roomCode);

		const pool = shuffle(CHAMPIONS.filter((c) => c.rarity !== 'gratuit').map((c) => c.name));
		const states: WhoamiPlayerState[] = players.map((p, i) => ({
			id: p.id,
			pseudo: p.pseudo,
			champion: pool[i % pool.length],
			found: false,
			failed: false,
			questionsUsed: 0,
			wrongGuesses: 0,
			points: 0,
		}));

		const session: WhoamiSession = {
			roomCode,
			players: states,
			activeIndex: 0,
			phase: 'answering',
			answers: new Map(),
			lastQuestion: null,
			lastGuess: null,
			deadline: Date.now() + roundTimeSec * 1000,
			roundTimeSec,
			onTimeout,
		};
		session.phaseTimeout = setTimeout(() => onTimeout(roomCode), roundTimeSec * 1000);
		this.sessions.set(roomCode, session);
	}

	hasSession(roomCode: string): boolean {
		return this.sessions.has(roomCode);
	}

	/** Reponse Oui/Non d'un joueur non-actif a la question en cours. */
	submitAnswer(
		roomCode: string,
		voterId: string,
		value: boolean,
	): { answeredCount: number; expectedCount: number; allAnswered: boolean } {
		const session = this.sessions.get(roomCode);
		if (!session || session.phase !== 'answering') {
			throw new Error("Ce n'est pas la phase de reponse.");
		}
		const active = session.players[session.activeIndex];
		if (voterId === active.id) throw new Error('Le joueur actif ne repond pas a sa propre question.');
		if (!session.players.some((p) => p.id === voterId)) {
			throw new Error('Tu ne fais pas partie de cette partie.');
		}
		if (session.answers.has(voterId)) throw new Error('Tu as deja repondu a cette question.');

		session.answers.set(voterId, value);
		return this.answerProgress(session);
	}

	/** Cloture la question en cours (tous ont repondu, ou timeout) et passe en phase decision. */
	closeQuestion(roomCode: string): WhoamiTurnState {
		const session = this.sessions.get(roomCode);
		if (!session) throw new Error('Aucune partie en cours.');
		if (session.phaseTimeout) clearTimeout(session.phaseTimeout);

		const yes = [...session.answers.values()].filter(Boolean).length;
		const no = session.answers.size - yes;
		const verdict: 'oui' | 'non' | 'egalite' = yes > no ? 'oui' : no > yes ? 'non' : 'egalite';
		session.lastQuestion = { yes, no, verdict };
		session.players[session.activeIndex].questionsUsed += 1;
		session.phase = 'decision';
		session.answers = new Map();
		this.armTimer(session);
		return this.turnState(session);
	}

	/** Le joueur actif enchaine une nouvelle question (verdict OUI uniquement, et sous le cap). */
	nextQuestion(roomCode: string, playerId: string): WhoamiTurnState {
		const session = this.sessions.get(roomCode);
		if (!session || session.phase !== 'decision') throw new Error("Ce n'est pas le moment.");
		const active = session.players[session.activeIndex];
		if (active.id !== playerId) throw new Error("Ce n'est pas ton tour.");
		const turn = this.turnState(session);
		if (!turn.canContinue) throw new Error('Verdict NON : ton tour passe, tente de deviner ou passe.');
		if (turn.mustGuess) throw new Error('Questions epuisees : tu dois deviner.');

		session.phase = 'answering';
		session.lastQuestion = null;
		this.armTimer(session);
		return this.turnState(session);
	}

	/** Le joueur actif passe son tour (apres un verdict NON, ou pour laisser la main). */
	passTurn(roomCode: string, playerId: string): { turn: WhoamiTurnState | null; finished: boolean } {
		const session = this.sessions.get(roomCode);
		if (!session || session.phase !== 'decision') throw new Error("Ce n'est pas le moment.");
		const active = session.players[session.activeIndex];
		if (active.id !== playerId) throw new Error("Ce n'est pas ton tour.");
		if (this.turnState(session).mustGuess) throw new Error('Questions epuisees : tu dois deviner.');
		return this.advanceTurn(session);
	}

	/** Tentative de devinette du joueur actif (phase decision uniquement). */
	submitGuess(
		roomCode: string,
		playerId: string,
		rawGuess: string,
	): { result: WhoamiGuessResult; turn: WhoamiTurnState | null; finished: boolean } {
		const session = this.sessions.get(roomCode);
		if (!session || session.phase !== 'decision') throw new Error("Ce n'est pas le moment de deviner.");
		const active = session.players[session.activeIndex];
		if (active.id !== playerId) throw new Error("Ce n'est pas ton tour.");

		const correct = normalize(rawGuess) === normalize(active.champion);
		let points = 0;
		let eliminated = false;
		if (correct) {
			points = Math.max(
				MIN_WIN_POINTS,
				BASE_POINTS - QUESTION_COST * active.questionsUsed - WRONG_GUESS_COST * active.wrongGuesses,
			);
			active.found = true;
			active.points = points;
		} else {
			active.wrongGuesses += 1;
			if (active.questionsUsed >= MAX_QUESTIONS) {
				active.failed = true;
				eliminated = true;
			}
		}

		const result: WhoamiGuessResult = {
			playerId: active.id,
			pseudo: active.pseudo,
			guess: rawGuess,
			correct,
			actualChampion: correct ? active.champion : null,
			points,
			eliminated,
		};
		session.lastGuess = result;

		const advance = this.advanceTurn(session);
		return { result, ...advance };
	}

	/** Timeout d'une phase : cloture la question (answering) ou passe le tour (decision). */
	handleTimeout(roomCode: string): { closedQuestion?: WhoamiTurnState; turn?: WhoamiTurnState | null; finished?: boolean } {
		const session = this.sessions.get(roomCode);
		if (!session) return {};
		if (session.phase === 'answering') {
			return { closedQuestion: this.closeQuestion(roomCode) };
		}
		// Decision AFK : si le cap est atteint on ne peut pas forcer une devinette a sa place,
		// on marque le joueur elimine pour ne pas bloquer la partie.
		const active = session.players[session.activeIndex];
		if (this.turnState(session).mustGuess) active.failed = true;
		return this.advanceTurn(session);
	}

	/** Retire un joueur parti en cours de partie. */
	removePlayer(
		roomCode: string,
		playerId: string,
	): { closedQuestion?: WhoamiTurnState; turn?: WhoamiTurnState | null; finished?: boolean } | undefined {
		const session = this.sessions.get(roomCode);
		if (!session) return undefined;
		const idx = session.players.findIndex((p) => p.id === playerId);
		if (idx === -1) return undefined;

		const wasActive = idx === session.activeIndex;
		session.players.splice(idx, 1);
		session.answers.delete(playerId);
		if (!session.players.length) {
			this.clearSession(roomCode);
			return { finished: false };
		}
		if (idx < session.activeIndex) session.activeIndex -= 1;
		if (wasActive) {
			session.activeIndex = session.activeIndex % session.players.length;
			// Le depart de l'actif peut laisser une table ou tous les survivants ont
			// deja fini (trouve/rate) : il ne faut PAS relancer une phase "answering"
			// sur un joueur deja found/failed (nextPlayableIndex renverrait undefined
			// et le "?? 0" retombait alors sur un index invalide/fini).
			if (session.players.every((p) => p.found || p.failed)) {
				return { finished: true };
			}
			// Le tour de l'absent est abandonne : on repart proprement du joueur suivant.
			session.activeIndex = this.nextPlayableIndex(session, session.activeIndex - 1) ?? session.activeIndex;
			session.phase = 'answering';
			session.answers = new Map();
			session.lastQuestion = null;
			this.armTimer(session);
			return { turn: this.turnState(session), finished: false };
		}
		if (session.phase === 'answering' && this.answerProgress(session).allAnswered) {
			return { closedQuestion: this.closeQuestion(roomCode) };
		}
		return {};
	}

	allDone(roomCode: string): boolean {
		const session = this.sessions.get(roomCode);
		if (!session) return true;
		return session.players.every((p) => p.found || p.failed);
	}

	computeResults(roomCode: string): WhoamiResult {
		const session = this.sessions.get(roomCode);
		if (!session) throw new Error('Aucune partie "Qui suis-je ?" en cours dans cette room.');
		if (session.phaseTimeout) clearTimeout(session.phaseTimeout);

		const rows = session.players
			.map((p) => ({
				playerId: p.id,
				pseudo: p.pseudo,
				champion: p.champion,
				found: p.found,
				questionsUsed: p.questionsUsed,
				points: p.points,
			}))
			.sort((a, b) => b.points - a.points);
		const scores: Record<string, number> = {};
		for (const row of rows) scores[row.playerId] = row.points;

		const best = rows.find((r) => r.found);
		const summary = best
			? `${best.pseudo} retrouve ${best.champion} en ${best.questionsUsed} question${best.questionsUsed > 1 ? 's' : ''}.`
			: "Personne n'a retrouve son champion. Difficile de se regarder en face.";

		const result: WhoamiResult = { rows, scores, summary };
		this.lastResults.set(roomCode, result);
		this.sessions.delete(roomCode);
		return result;
	}

	getSnapshot(roomCode: string, viewerId: string): WhoamiSnapshot {
		const session = this.sessions.get(roomCode);
		if (!session) {
			return {
				active: false,
				assignments: [],
				turn: null,
				myAnswered: false,
				answeredCount: 0,
				expectedCount: 0,
				lastGuess: null,
				results: this.lastResults.get(roomCode) ?? null,
			};
		}
		const progress = this.answerProgress(session);
		return {
			active: true,
			assignments: this.assignmentsFor(session, viewerId),
			turn: this.turnState(session),
			myAnswered: session.answers.has(viewerId),
			answeredCount: progress.answeredCount,
			expectedCount: progress.expectedCount,
			lastGuess: session.lastGuess,
			results: null,
		};
	}

	assignmentsFor(sessionOrCode: WhoamiSession | string, viewerId: string): WhoamiAssignmentView[] {
		const session =
			typeof sessionOrCode === 'string' ? this.sessions.get(sessionOrCode) : sessionOrCode;
		if (!session) return [];
		return session.players.map((p) => ({
			playerId: p.id,
			pseudo: p.pseudo,
			// Son propre champion reste masque tant qu'il ne l'a pas trouve.
			champion: p.id === viewerId && !p.found ? null : p.champion,
			found: p.found,
			failed: p.failed,
			questionsUsed: p.questionsUsed,
			points: p.points,
		}));
	}

	getPlayers(roomCode: string): WhoamiPlayerRef[] {
		return (this.sessions.get(roomCode)?.players ?? []).map((p) => ({ id: p.id, pseudo: p.pseudo }));
	}

	turnStateOf(roomCode: string): WhoamiTurnState | null {
		const session = this.sessions.get(roomCode);
		return session ? this.turnState(session) : null;
	}

	private turnState(session: WhoamiSession): WhoamiTurnState {
		const active = session.players[session.activeIndex];
		return {
			activePlayerId: active.id,
			activePseudo: active.pseudo,
			phase: session.phase,
			deadline: session.deadline,
			questionsUsed: active.questionsUsed,
			lastQuestion: session.lastQuestion,
			canContinue: session.lastQuestion?.verdict === 'oui' && active.questionsUsed < MAX_QUESTIONS,
			mustGuess: active.questionsUsed >= MAX_QUESTIONS,
		};
	}

	private advanceTurn(session: WhoamiSession): { turn: WhoamiTurnState | null; finished: boolean } {
		if (session.players.every((p) => p.found || p.failed)) {
			return { turn: null, finished: true };
		}
		const next = this.nextPlayableIndex(session, session.activeIndex);
		session.activeIndex = next ?? session.activeIndex;
		session.phase = 'answering';
		session.answers = new Map();
		session.lastQuestion = null;
		this.armTimer(session);
		return { turn: this.turnState(session), finished: false };
	}

	private nextPlayableIndex(session: WhoamiSession, fromIndex: number): number | undefined {
		for (let step = 1; step <= session.players.length; step++) {
			const idx = (fromIndex + step) % session.players.length;
			const p = session.players[idx];
			if (!p.found && !p.failed) return idx;
		}
		return undefined;
	}

	private answerProgress(session: WhoamiSession): { answeredCount: number; expectedCount: number; allAnswered: boolean } {
		const answeredCount = session.answers.size;
		const expectedCount = session.players.length - 1;
		return { answeredCount, expectedCount, allAnswered: answeredCount >= expectedCount };
	}

	private armTimer(session: WhoamiSession): void {
		if (session.phaseTimeout) clearTimeout(session.phaseTimeout);
		session.deadline = Date.now() + session.roundTimeSec * 1000;
		session.phaseTimeout = setTimeout(() => session.onTimeout(session.roomCode), session.roundTimeSec * 1000);
	}

	private clearSession(roomCode: string): void {
		const existing = this.sessions.get(roomCode);
		if (existing?.phaseTimeout) clearTimeout(existing.phaseTimeout);
		this.sessions.delete(roomCode);
	}
}
