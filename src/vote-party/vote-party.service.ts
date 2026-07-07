import { Injectable } from '@nestjs/common';
import { VOTE_PARTY_QUESTIONS } from './data/vote-party-questions.data';
import {
	VotePartyPlayerRef,
	VotePartyResult,
	VotePartyRoundResult,
	VotePartySnapshot,
	VotePartyTally,
} from './interfaces/vote-party.interface';

const MAJORITY_POINTS = 10;
const ELECTED_BONUS = 5;
/** Filet de securite : si l'host ne fait pas avancer le reveal, le serveur avance tout seul. */
const REVEAL_SAFETY_TIME_SEC = 90;

interface VotePartySession {
	roomCode: string;
	players: VotePartyPlayerRef[];
	questions: string[];
	roundIndex: number;
	totalRounds: number;
	phase: 'voting' | 'reveal' | 'results';
	/** voterId -> targetId (null = abstention au timeout). */
	votes: Map<string, string | null>;
	totalScores: Record<string, number>;
	lastRound: VotePartyRoundResult | null;
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
 * Etat "Vote Party" en memoire, par room. Meme convention que LoldleService :
 * une session vit le temps d'une partie puis est nettoyee dans computeResults()
 * (le resultat final reste dans `lastResults` pour un client en retard).
 */
@Injectable()
export class VotePartyService {
	private sessions = new Map<string, VotePartySession>();
	private lastResults = new Map<string, VotePartyResult>();

	startSession(
		roomCode: string,
		players: VotePartyPlayerRef[],
		totalRounds: number,
		roundTimeSec: number,
		onTimeout: (roomCode: string) => void,
	): { question: string; roundNumber: number; totalRounds: number; deadline: number } {
		this.clearSession(roomCode);
		this.lastResults.delete(roomCode);

		const questions = shuffle(VOTE_PARTY_QUESTIONS).slice(0, totalRounds);
		const session: VotePartySession = {
			roomCode,
			players,
			questions,
			roundIndex: 0,
			totalRounds: questions.length,
			phase: 'voting',
			votes: new Map(),
			totalScores: Object.fromEntries(players.map((p) => [p.id, 0])),
			lastRound: null,
			deadline: Date.now() + roundTimeSec * 1000,
		};
		session.phaseTimeout = setTimeout(() => onTimeout(roomCode), roundTimeSec * 1000);
		this.sessions.set(roomCode, session);

		return {
			question: questions[0],
			roundNumber: 1,
			totalRounds: session.totalRounds,
			deadline: session.deadline,
		};
	}

	phaseOf(roomCode: string): 'voting' | 'reveal' | 'results' | undefined {
		return this.sessions.get(roomCode)?.phase;
	}

	/** Enregistre le vote (irrevocable, pas de self-vote). Renvoie l'avancement pour le broadcast. */
	submitVote(
		roomCode: string,
		voterId: string,
		targetId: string | null,
	): { votedCount: number; expectedCount: number; allVoted: boolean } {
		const session = this.sessions.get(roomCode);
		if (!session || session.phase !== 'voting') {
			throw new Error("Ce n'est pas la phase de vote.");
		}
		if (!session.players.some((p) => p.id === voterId)) {
			throw new Error('Tu ne fais pas partie de cette manche.');
		}
		if (session.votes.has(voterId)) {
			throw new Error('Tu as deja vote pour cette question.');
		}
		if (targetId === voterId) {
			throw new Error('Impossible de voter pour soi-meme.');
		}
		if (targetId !== null && !session.players.some((p) => p.id === targetId)) {
			throw new Error('Ce joueur ne fait pas partie de la manche.');
		}

		session.votes.set(voterId, targetId);
		return this.voteProgress(session);
	}

	/** Cloture la manche : abstention forcee pour les votes manquants, calcule le tally et les points. */
	revealRound(roomCode: string, onRevealTimeout: (roomCode: string) => void): VotePartyRoundResult {
		const session = this.sessions.get(roomCode);
		if (!session) throw new Error('Aucune partie Vote Party en cours dans cette room.');
		if (session.phaseTimeout) clearTimeout(session.phaseTimeout);
		session.phase = 'reveal';

		for (const p of session.players) {
			if (!session.votes.has(p.id)) session.votes.set(p.id, null);
		}

		const byTarget = new Map<string, string[]>();
		for (const [voterId, targetId] of session.votes.entries()) {
			if (!targetId) continue;
			if (!byTarget.has(targetId)) byTarget.set(targetId, []);
			byTarget.get(targetId)!.push(voterId);
		}

		const pseudoOf = (id: string) => session.players.find((p) => p.id === id)?.pseudo ?? 'Joueur';
		const tallies: VotePartyTally[] = [...byTarget.entries()]
			.map(([playerId, voterIds]) => ({
				playerId,
				pseudo: pseudoOf(playerId),
				votes: voterIds.length,
				voters: voterIds.map((id) => ({ playerId: id, pseudo: pseudoOf(id) })),
			}))
			.sort((a, b) => b.votes - a.votes);

		const maxVotes = tallies[0]?.votes ?? 0;
		const electedIds = tallies.filter((t) => t.votes === maxVotes && maxVotes > 0).map((t) => t.playerId);

		const roundPoints: Record<string, number> = Object.fromEntries(session.players.map((p) => [p.id, 0]));
		for (const [voterId, targetId] of session.votes.entries()) {
			if (targetId && electedIds.includes(targetId)) roundPoints[voterId] = (roundPoints[voterId] ?? 0) + MAJORITY_POINTS;
		}
		for (const electedId of electedIds) {
			roundPoints[electedId] = (roundPoints[electedId] ?? 0) + ELECTED_BONUS;
		}
		for (const [playerId, pts] of Object.entries(roundPoints)) {
			session.totalScores[playerId] = (session.totalScores[playerId] ?? 0) + pts;
		}

		const result: VotePartyRoundResult = {
			question: session.questions[session.roundIndex],
			roundNumber: session.roundIndex + 1,
			totalRounds: session.totalRounds,
			tallies,
			electedIds,
			roundPoints,
			totalScores: { ...session.totalScores },
		};
		session.lastRound = result;
		// Filet de securite : le reveal n'est avance que par l'host ; si son client
		// ne suit plus, le serveur avance a sa place au bout du delai.
		session.phaseTimeout = setTimeout(() => onRevealTimeout(roomCode), REVEAL_SAFETY_TIME_SEC * 1000);
		return result;
	}

	isLastRound(roomCode: string): boolean {
		const session = this.sessions.get(roomCode);
		return !session || session.roundIndex + 1 >= session.totalRounds;
	}

	/** Passe a la question suivante (phase reveal uniquement, appele par l'host). */
	nextRound(
		roomCode: string,
		roundTimeSec: number,
		onTimeout: (roomCode: string) => void,
	): { question: string; roundNumber: number; totalRounds: number; deadline: number } {
		const session = this.sessions.get(roomCode);
		if (!session || session.phase !== 'reveal') {
			throw new Error('La manche en cours ne peut pas encore etre passee.');
		}
		if (this.isLastRound(roomCode)) throw new Error('Toutes les questions sont deja passees.');
		if (session.phaseTimeout) clearTimeout(session.phaseTimeout);

		session.roundIndex += 1;
		session.phase = 'voting';
		session.votes = new Map();
		session.deadline = Date.now() + roundTimeSec * 1000;
		session.phaseTimeout = setTimeout(() => onTimeout(roomCode), roundTimeSec * 1000);

		return {
			question: session.questions[session.roundIndex],
			roundNumber: session.roundIndex + 1,
			totalRounds: session.totalRounds,
			deadline: session.deadline,
		};
	}

	computeResults(roomCode: string): VotePartyResult {
		const session = this.sessions.get(roomCode);
		if (!session) throw new Error('Aucune partie Vote Party en cours dans cette room.');
		if (session.phaseTimeout) clearTimeout(session.phaseTimeout);

		const rows = session.players
			.map((p) => ({ playerId: p.id, pseudo: p.pseudo, points: session.totalScores[p.id] ?? 0 }))
			.sort((a, b) => b.points - a.points);
		const summary = rows.length
			? `${rows[0].pseudo} lit le lobby comme un livre ouvert (${rows[0].points} pts).`
			: 'Vote Party termine.';

		const result: VotePartyResult = { rows, scores: { ...session.totalScores }, summary };
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
		// Les votes qui ciblaient le partant deviennent des abstentions (meme
		// representation que le timeout : null) pour ne pas elire un absent,
		// sans rendre la main aux votants (leur vote reste enregistre).
		for (const [voterId, targetId] of session.votes.entries()) {
			if (targetId === playerId) session.votes.set(voterId, null);
		}
		if (session.phase !== 'voting') return { allVoted: false };
		return { allVoted: session.players.length > 0 && this.voteProgress(session).allVoted };
	}

	getSnapshot(roomCode: string, playerId: string): VotePartySnapshot {
		const session = this.sessions.get(roomCode);
		if (!session) {
			return {
				active: false,
				phase: 'results',
				question: null,
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
			question: session.questions[session.roundIndex],
			roundNumber: session.roundIndex + 1,
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

	private voteProgress(session: VotePartySession): { votedCount: number; expectedCount: number; allVoted: boolean } {
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
