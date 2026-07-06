import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RoomsService } from "../rooms/rooms.service";

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AdminMetricsService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly roomsService: RoomsService,
	) {}

	async getSummary(days: number = 30) {
		const now = new Date();
		const from = new Date(now.getTime() - days * DAY_MS);

		const [live, connections, games, rooms, tiktok, retention] = await Promise.all([
			this.getLive(),
			this.getConnections(from, now),
			this.getGames(from),
			this.getRooms(from),
			this.getTiktok(),
			this.getRetention(now),
		]);

		return { period: { from: from.toISOString(), to: now.toISOString() }, live, connections, retention, games, rooms, tiktok };
	}

	private async getLive() {
		const { activeRooms, activePlayers } = this.roomsService.getLiveStats();
		const dayAgo = new Date(Date.now() - DAY_MS);
		const activeToday = await this.prisma.connectionEvent.findMany({
			where: { type: "CONNECT", createdAt: { gte: dayAgo } },
			select: { anonId: true },
			distinct: ["anonId"],
		});
		return {
			activeRoomsNow: activeRooms,
			activePlayersNow: activePlayers,
			activeUsersToday: activeToday.length,
		};
	}

	private async getConnections(from: Date, to: Date) {
		const [total, uniqueRows, byDayRaw] = await Promise.all([
			this.prisma.connectionEvent.count({ where: { type: "CONNECT", createdAt: { gte: from, lte: to } } }),
			this.prisma.connectionEvent.findMany({
				where: { type: "CONNECT", createdAt: { gte: from, lte: to } },
				select: { anonId: true },
				distinct: ["anonId"],
			}),
			this.prisma.connectionEvent.findMany({
				where: { type: "CONNECT", createdAt: { gte: from, lte: to } },
				select: { anonId: true, createdAt: true },
			}),
		]);

		const byDay = new Map<string, Set<string>>();
		for (const row of byDayRaw) {
			const day = row.createdAt.toISOString().slice(0, 10);
			if (!byDay.has(day)) byDay.set(day, new Set());
			byDay.get(day)!.add(row.anonId);
		}
		const uniqueByDay = [...byDay.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([date, ids]) => ({ date, unique: ids.size }));

		return { total, unique: uniqueRows.length, uniqueByDay };
	}

	/** Retention simple : parmi les anonId actifs il y a N jours, quelle part revient aujourd'hui. */
	private async getRetention(now: Date) {
		const activeInWindow = async (startDaysAgo: number, endDaysAgo: number) => {
			const rows = await this.prisma.connectionEvent.findMany({
				where: {
					type: "CONNECT",
					createdAt: {
						gte: new Date(now.getTime() - startDaysAgo * DAY_MS),
						lt: new Date(now.getTime() - endDaysAgo * DAY_MS),
					},
				},
				select: { anonId: true },
				distinct: ["anonId"],
			});
			return new Set(rows.map((r) => r.anonId));
		};

		const ratio = async (cohortDaysAgo: number) => {
			const cohort = await activeInWindow(cohortDaysAgo + 1, cohortDaysAgo);
			if (!cohort.size) return null;
			const today = await activeInWindow(1, 0);
			let returned = 0;
			for (const id of cohort) if (today.has(id)) returned += 1;
			return returned / cohort.size;
		};

		const [d1, d7] = await Promise.all([ratio(1), ratio(7)]);
		return { d1, d7 };
	}

	private async getGames(from: Date) {
		const events = await this.prisma.sessionEvent.groupBy({
			by: ["gameId", "type"],
			where: { createdAt: { gte: from } },
			_count: { _all: true },
		});

		const byGame = new Map<string, { started: number; completed: number; abandoned: number }>();
		for (const row of events) {
			if (!byGame.has(row.gameId)) byGame.set(row.gameId, { started: 0, completed: 0, abandoned: 0 });
			const entry = byGame.get(row.gameId)!;
			if (row.type === "GAME_STARTED") entry.started = row._count._all;
			else if (row.type === "GAME_COMPLETED") entry.completed = row._count._all;
			else if (row.type === "GAME_ABANDONED") entry.abandoned = row._count._all;
		}

		const list = [...byGame.entries()]
			.map(([gameId, v]) => ({
				gameId,
				...v,
				completionRate: v.started ? v.completed / v.started : null,
				abandonRate: v.started ? v.abandoned / v.started : null,
			}))
			.sort((a, b) => (b.abandonRate ?? 0) - (a.abandonRate ?? 0));

		return {
			byId: list,
			mostPlayed: [...list].sort((a, b) => b.started - a.started)[0]?.gameId ?? null,
			leastPlayed: [...list].sort((a, b) => a.started - b.started)[0]?.gameId ?? null,
			highestAbandon: list[0]?.gameId ?? null,
		};
	}

	private async getRooms(from: Date) {
		const rooms = await this.prisma.room.findMany({
			where: { createdAt: { gte: from } },
			select: { createdAt: true, closedAt: true, maxPlayersReached: true },
		});
		const closed = rooms.filter((r) => r.closedAt);
		const avgLifetimeSec = closed.length
			? closed.reduce((sum, r) => sum + (r.closedAt!.getTime() - r.createdAt.getTime()) / 1000, 0) / closed.length
			: null;
		const avgSize = rooms.length
			? rooms.reduce((sum, r) => sum + r.maxPlayersReached, 0) / rooms.length
			: null;
		return { total: rooms.length, avgLifetimeSec, avgSize };
	}

	private async getTiktok() {
		const [totalVotes, topQuestionsRaw] = await Promise.all([
			this.prisma.tiktokVote.count(),
			this.prisma.tiktokVote.groupBy({
				by: ["question"],
				_count: { _all: true },
				orderBy: { _count: { question: "desc" } },
				take: 5,
			}),
		]);
		return {
			totalVotes,
			topQuestions: topQuestionsRaw.map((q) => ({ question: q.question, votes: q._count._all })),
		};
	}
}
