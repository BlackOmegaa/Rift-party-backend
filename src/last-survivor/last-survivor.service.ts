import { Injectable } from '@nestjs/common';
import {
	LAST_SURVIVOR_CATEGORIES,
	LastSurvivorCandidate,
} from './data/last-survivor-categories.data';
import {
	LastSurvivorPlayerRef,
	LastSurvivorResult,
	LastSurvivorRoundResult,
	LastSurvivorSnapshot,
	LastSurvivorTally,
} from './interfaces/last-survivor.interface';

const MAJORITY_POINTS = 10;
/** Filet de securite : si l'host ne fait pas avancer le reveal, le serveur avance tout seul. */
const REVEAL_SAFETY_TIME_SEC = 90;

interface LastSurvivorSession {
	roomCode: string;
	players: LastSurvivorPlayerRef[];
	category: string;
	remaining: LastSurvivorCandidate[];
	totalRounds: number;
	roundNumber: number;
	phase: 'voting' | 'reveal' | 'results';
	/** voterId -> label du candidat vise (null = abstention au timeout). */
	votes: Map<string, string | null>;
	totalScores: Record<string, number>;
	lastRound: LastSurvivorRoundResult | null;
	deadline: number;
	phaseTimeout?: NodeJS.Timeout;
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
 * Etat "Last Survivor" en memoire, par room. Meme convention que VotePartyService :
 * une session vit le temps d'une partie puis est nettoyee dans computeResults().
 */
@Injectable()
export class LastSurvivorService {
	private sessions = new Map<string, LastSurvivorSession>();
	private lastResults = new Map<string, LastSurvivorResult>();

	startSession(
		roomCode: string,
		players: LastSurvivorPlayerRef[],
		poolSize: number,
		roundTimeSec: number,
		onTimeout: (roomCode: string) => void,
	): { category: string; candidates: LastSurvivorCandidate[]; roundNumber: number; totalRounds: number; deadline: number } {
		this.clearSession(roomCode);
		this.lastResults.delete(roomCode);

		const category = LAST_SURVIVOR_CATEGORIES[Math.floor(Math.random() * LAST_SURVIVOR_CATEGORIES.length)];
		const remaining = shuffle(category.candidates).slice(0, Math.max(3, poolSize));

		const session: LastSurvivorSession = {
			roomCode,
			players,
			category: category.title,
			remaining,
			totalRounds: remaining.length - 1,
			roundNumber: 1,
			phase: 'voting',
			votes: new Map(),
			totalScores: Object.fromEntries(players.map((p) => [p.id, 0])),
			lastRound: null,
			deadline: Date.now() + roundTimeSec * 1000,
		};
		session.phaseTimeout = setTimeout(() => onTimeout(roomCode), roundTimeSec * 1000);
		this.sessions.set(roomCode, session);

		return {
			category: session.category,
			candidates: remaining,
			roundNumber: 1,
			totalRounds: session.totalRounds,
			deadline: session.deadline,
		};
	}

	phaseOf(roomCode: string): 'voting' | 'reveal' | 'results' | undefined {
		return this.sessions.get(roomCode)?.phase;
	}

	/** Enregistre le vote d'elimination (irrevocable). Renvoie l'avancement pour le broadcast. */
	submitVote(
		roomCode: string,
		voterId: string,
		targetLabel: string | null,
	): { votedCount: number; expectedCount: number; allVoted: boolean } {
		const session = this.sessions.get(roomCode);
		if (!session || session.phase !== 'voting') {
			throw new Error("Ce n'est pas la phase de vote.");
		}
		if (!session.players.some((p) => p.id === voterId)) {
			throw new Error('Tu ne fais pas partie de cette manche.');
		}
		if (session.votes.has(voterId)) {
			throw new Error('Tu as deja vote pour cette elimination.');
		}
		if (targetLabel !== null && !session.remaining.some((cand) => cand.label === targetLabel)) {
			throw new Error('Ce candidat ne fait pas partie de la manche.');
		}

		session.votes.set(voterId, targetLabel);
		return this.voteProgress(session);
	}

	/** Cloture la manche : abstention forcee pour les votes manquants, elimine le plus vote (tirage au sort entre ex aequo). */
	revealRound(roomCode: string, onRevealTimeout: (roomCode: string) => void): LastSurvivorRoundResult {
		const session = this.sessions.get(roomCode);
		if (!session) throw new Error('Aucune partie Last Survivor en cours dans cette room.');
		if (session.phaseTimeout) clearTimeout(session.phaseTimeout);
		session.phase = 'reveal';

		for (const p of session.players) {
			if (!session.votes.has(p.id)) session.votes.set(p.id, null);
		}

		const pseudoOf = (id: string) => session.players.find((p) => p.id === id)?.pseudo ?? 'Joueur';
		const byLabel = new Map<string, string[]>();
		for (const [voterId, label] of session.votes.entries()) {
			if (!label) continue;
			if (!byLabel.has(label)) byLabel.set(label, []);
			byLabel.get(label)!.push(voterId);
		}

		const tallies: LastSurvivorTally[] = session.remaining
			.map((cand) => ({
				label: cand.label,
				champion: cand.champion,
				votes: byLabel.get(cand.label)?.length ?? 0,
				voters: (byLabel.get(cand.label) ?? []).map((id) => ({ playerId: id, pseudo: pseudoOf(id) })),
			}))
			.sort((a, b) => b.votes - a.votes);

		const maxVotes = tallies[0]?.votes ?? 0;
		const topLabels = tallies.filter((t) => t.votes === maxVotes).map((t) => t.label);
		const tieBreak = topLabels.length > 1 || maxVotes === 0;
		const eliminatedLabel = topLabels[Math.floor(Math.random() * topLabels.length)];
		const eliminated = session.remaining.find((cand) => cand.label === eliminatedLabel)!;

		session.remaining = session.remaining.filter((cand) => cand.label !== eliminatedLabel);

		const roundPoints: Record<string, number> = Object.fromEntries(session.players.map((p) => [p.id, 0]));
		for (const [voterId, label] of session.votes.entries()) {
			if (label === eliminatedLabel) roundPoints[voterId] = (roundPoints[voterId] ?? 0) + MAJORITY_POINTS;
		}
		for (const [playerId, pts] of Object.entries(roundPoints)) {
			session.totalScores[playerId] = (session.totalScores[playerId] ?? 0) + pts;
		}

		const result: LastSurvivorRoundResult = {
			category: session.category,
			roundNumber: session.roundNumber,
			totalRounds: session.totalRounds,
			tallies,
			eliminated,
			tieBreak,
			remaining: [...session.remaining],
			roundPoints,
			totalScores: { ...session.totalScores },
		};
		session.lastRound = result;
		// Filet de securite : le reveal n'est avance que par l'host ; si son client
		// ne suit plus, le serveur avance a sa place au bout du delai.
		session.phaseTimeout = setTimeout(() => onRevealTimeout(roomCode), REVEAL_SAFETY_TIME_SEC * 1000);
		return result;
	}

	isFinished(roomCode: string): boolean {
		const session = this.sessions.get(roomCode);
		return !session || session.remaining.length <= 1;
	}

	/** Passe a l'elimination suivante (phase reveal uniquement, appele par l'host). */
	nextRound(
		roomCode: string,
		roundTimeSec: number,
		onTimeout: (roomCode: string) => void,
	): { category: string; candidates: LastSurvivorCandidate[]; roundNumber: number; totalRounds: number; deadline: number } {
		const session = this.sessions.get(roomCode);
		if (!session || session.phase !== 'reveal') {
			throw new Error('La manche en cours ne peut pas encore etre passee.');
		}
		if (this.isFinished(roomCode)) throw new Error('Le tournoi est deja termine.');
		if (session.phaseTimeout) clearTimeout(session.phaseTimeout);

		session.roundNumber += 1;
		session.phase = 'voting';
		session.votes = new Map();
		session.deadline = Date.now() + roundTimeSec * 1000;
		session.phaseTimeout = setTimeout(() => onTimeout(roomCode), roundTimeSec * 1000);

		return {
			category: session.category,
			candidates: [...session.remaining],
			roundNumber: session.roundNumber,
			totalRounds: session.totalRounds,
			deadline: session.deadline,
		};
	}

	computeResults(roomCode: string): LastSurvivorResult {
		const session = this.sessions.get(roomCode);
		if (!session) throw new Error('Aucune partie Last Survivor en cours dans cette room.');
		if (session.phaseTimeout) clearTimeout(session.phaseTimeout);

		const winner = session.remaining[0] ?? { champion: 'Teemo', label: 'Teemo' };
		const rows = session.players
			.map((p) => ({ playerId: p.id, pseudo: p.pseudo, points: session.totalScores[p.id] ?? 0 }))
			.sort((a, b) => b.points - a.points);
		const summary = `${winner.label} survit au vote "${session.category}".`;

		const result: LastSurvivorResult = {
			category: session.category,
			winner,
			rows,
			scores: { ...session.totalScores },
			summary,
		};
		this.lastResults.set(roomCode, result);
		this.sessions.delete(roomCode);
		return result;
	}

	/** Retire un joueur parti en cours de partie pour ne pas bloquer l'attente des votes. */
	removePlayer(roomCode: string, playerId: string): { allVoted: boolean } | undefined {
		const session = this.sessions.get(roomCode);
		if (!session) return undefined;
		session.players = session.players.filter((p) => p.id !== playerId);
		session.votes.delete(playerId);
		if (session.phase !== 'voting') return { allVoted: false };
		return { allVoted: session.players.length > 0 && this.voteProgress(session).allVoted };
	}

	getSnapshot(roomCode: string, playerId: string): LastSurvivorSnapshot {
		const session = this.sessions.get(roomCode);
		if (!session) {
			return {
				active: false,
				phase: 'results',
				category: null,
				candidates: [],
				roundNumber: 0,
				totalRounds: 0,
				deadline: null,
				myVote: null,
				votedCount: 0,
				expectedCount: 0,
				lastRound: null,
				results: this.lastResults.get(roomCode) ?? null,
			};
		}
		const progress = this.voteProgress(session);
		return {
			active: true,
			phase: session.phase,
			category: session.category,
			candidates: [...session.remaining],
			roundNumber: session.roundNumber,
			totalRounds: session.totalRounds,
			deadline: session.deadline,
			myVote: session.votes.get(playerId) ?? null,
			votedCount: progress.votedCount,
			expectedCount: progress.expectedCount,
			lastRound: session.phase === 'reveal' ? session.lastRound : null,
			results: null,
		};
	}

	/** Nettoyage complet a la fermeture de la room : timers + session + dernier resultat. */
	clearRoom(roomCode: string): void {
		this.clearSession(roomCode);
		this.lastResults.delete(roomCode);
	}

	private voteProgress(session: LastSurvivorSession): { votedCount: number; expectedCount: number; allVoted: boolean } {
		const votedCount = session.votes.size;
		const expectedCount = session.players.length;
		return { votedCount, expectedCount, allVoted: votedCount >= expectedCount };
	}

	private clearSession(roomCode: string): void {
		const existing = this.sessions.get(roomCode);
		if (existing?.phaseTimeout) clearTimeout(existing.phaseTimeout);
		this.sessions.delete(roomCode);
	}
}
