import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RoomsService } from "../rooms/rooms.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const ROOM_SIZE_BUCKETS = ["2", "3", "4", "5", "6+"] as const;

interface Period {
	from: Date;
	to: Date;
}

/**
 * KPI produit pour le dashboard admin, organises par les sections du roadmap
 * (acquisition / conversion / engagement / modes / retention / viralite).
 * Chaque section est une methode privee independante : ni le controller ni le
 * frontend n'ont a connaitre l'organisation interne des requetes, seulement
 * la forme du JSON retourne par `getSummary`.
 *
 * Choix de perf : les agregations simples passent par l'API Prisma
 * (groupBy/aggregate, deja indexees) ; les calculs qui melangent plusieurs
 * tables ou font de l'arithmetique de dates (duree de session, retention par
 * cohorte) passent par du SQL brut ($queryRaw) plutot que de rapatrier les
 * lignes en Node pour les recorreler a la main.
 */
@Injectable()
export class AdminMetricsService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly roomsService: RoomsService,
	) {}

	async getSummary(from?: Date, to?: Date) {
		const period: Period = {
			from: from ?? new Date(Date.now() - 30 * DAY_MS),
			to: to ?? new Date(),
		};

		const [live, todayVsYesterday, acquisition, conversion, engagement, modes, retention, virality] =
			await Promise.all([
				this.getLive(),
				this.getTodayVsYesterday(),
				this.getAcquisition(period),
				this.getConversion(period),
				this.getEngagement(period),
				this.getModes(period),
				this.getRetention(period),
				this.getVirality(period),
			]);

		return {
			period: { from: period.from.toISOString(), to: period.to.toISOString() },
			live,
			todayVsYesterday,
			acquisition,
			conversion,
			engagement,
			modes,
			retention,
			virality,
		};
	}

	// ---------------------------------------------------------------------
	// Live (etat en memoire, pas de periode)
	// ---------------------------------------------------------------------

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

	/** Comparaison jour calendaire vs veille, toujours relative a "maintenant" (independante du filtre de periode choisi dans le dashboard). */
	private async getTodayVsYesterday() {
		const now = new Date();
		const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const yesterdayStart = new Date(todayStart.getTime() - DAY_MS);

		const [activeUsersToday, activeUsersYesterday, newVisitorsToday, newVisitorsYesterday] = await Promise.all([
			this.countDistinctAnonId({ type: "CONNECT", createdAt: { gte: todayStart } }),
			this.countDistinctAnonId({ type: "CONNECT", createdAt: { gte: yesterdayStart, lt: todayStart } }),
			this.prisma.visitor.count({ where: { firstSeenAt: { gte: todayStart } } }),
			this.prisma.visitor.count({ where: { firstSeenAt: { gte: yesterdayStart, lt: todayStart } } }),
		]);

		return {
			activeUsers: { today: activeUsersToday, yesterday: activeUsersYesterday },
			newVisitors: { today: newVisitorsToday, yesterday: newVisitorsYesterday },
		};
	}

	private async countDistinctAnonId(where: { type: "CONNECT"; createdAt: { gte: Date; lt?: Date } }) {
		const rows = await this.prisma.connectionEvent.findMany({
			where,
			select: { anonId: true },
			distinct: ["anonId"],
		});
		return rows.length;
	}

	// ---------------------------------------------------------------------
	// Acquisition
	// ---------------------------------------------------------------------

	private async getAcquisition(period: Period) {
		const [uniqueVisitors, newVsReturning, dailySeries, bySource] = await Promise.all([
			this.countDistinctAnonId({ type: "CONNECT", createdAt: { gte: period.from, lt: period.to } }),
			this.prisma.$queryRaw<{ new_count: bigint; returning_count: bigint }[]>`
				SELECT
					COUNT(DISTINCT ce."anonId") FILTER (WHERE v."firstSeenAt" >= ${period.from}) AS new_count,
					COUNT(DISTINCT ce."anonId") FILTER (WHERE v."firstSeenAt" IS NULL OR v."firstSeenAt" < ${period.from}) AS returning_count
				FROM "ConnectionEvent" ce
				LEFT JOIN "Visitor" v ON v."anonId" = ce."anonId"
				WHERE ce.type = 'CONNECT' AND ce."createdAt" BETWEEN ${period.from} AND ${period.to}
			`,
			this.prisma.$queryRaw<{ day: Date; unique_visitors: bigint; new_visitors: bigint }[]>`
				SELECT
					DATE_TRUNC('day', ce."createdAt") AS day,
					COUNT(DISTINCT ce."anonId") AS unique_visitors,
					COUNT(DISTINCT ce."anonId") FILTER (
						WHERE v."firstSeenAt" >= DATE_TRUNC('day', ce."createdAt")
						AND v."firstSeenAt" < DATE_TRUNC('day', ce."createdAt") + interval '1 day'
					) AS new_visitors
				FROM "ConnectionEvent" ce
				LEFT JOIN "Visitor" v ON v."anonId" = ce."anonId"
				WHERE ce.type = 'CONNECT' AND ce."createdAt" BETWEEN ${period.from} AND ${period.to}
				GROUP BY 1
				ORDER BY 1
			`,
			this.prisma.$queryRaw<{ source: string; count: bigint }[]>`
				SELECT COALESCE(v."acquisitionSource", 'inconnu') AS source, COUNT(*) AS count
				FROM "Visitor" v
				WHERE v."firstSeenAt" BETWEEN ${period.from} AND ${period.to}
				GROUP BY 1
				ORDER BY 2 DESC
			`,
		]);

		const newVisitors = Number(newVsReturning[0]?.new_count ?? 0);
		const returningVisitors = Number(newVsReturning[0]?.returning_count ?? 0);
		const sourceTotal = bySource.reduce((sum, row) => sum + Number(row.count), 0);

		return {
			uniqueVisitors,
			newVisitors,
			returningVisitors,
			dailySeries: dailySeries.map((row) => ({
				date: row.day.toISOString().slice(0, 10),
				uniqueVisitors: Number(row.unique_visitors),
				newVisitors: Number(row.new_visitors),
				returningVisitors: Number(row.unique_visitors) - Number(row.new_visitors),
			})),
			bySource: bySource.map((row) => ({
				source: row.source,
				count: Number(row.count),
				pct: sourceTotal ? Number(row.count) / sourceTotal : 0,
			})),
		};
	}

	// ---------------------------------------------------------------------
	// Conversion
	// ---------------------------------------------------------------------

	private async getConversion(period: Period) {
		const dateFilter = { gte: period.from, lt: period.to };
		const [roomsCreated, playersJoinedRows, gameStartedRows, uniqueVisitors] = await Promise.all([
			this.prisma.room.count({ where: { createdAt: dateFilter } }),
			this.prisma.roomJoin.findMany({ where: { createdAt: dateFilter }, select: { anonId: true }, distinct: ["anonId"] }),
			this.prisma.gameSession.findMany({ where: { startedAt: dateFilter }, select: { anonId: true }, distinct: ["anonId"] }),
			this.countDistinctAnonId({ type: "CONNECT", createdAt: { gte: period.from, lt: period.to } }),
		]);

		const playersJoined = playersJoinedRows.length;
		const playersStartedGame = gameStartedRows.length;

		return {
			roomsCreated,
			visitorToRoomRate: uniqueVisitors ? roomsCreated / uniqueVisitors : null,
			playersJoined,
			visitorToGameStartedRate: uniqueVisitors ? playersStartedGame / uniqueVisitors : null,
		};
	}

	// ---------------------------------------------------------------------
	// Engagement
	// ---------------------------------------------------------------------

	private async getEngagement(period: Period) {
		const dateFilter = { gte: period.from, lt: period.to };

		const [totalGamesPlayed, roomsCreated, avgPlayers, roomSizeRaw, matches, avgSessionRaw] = await Promise.all([
			this.prisma.round.count({ where: { finishedAt: dateFilter } }),
			this.prisma.room.count({ where: { createdAt: dateFilter } }),
			this.prisma.room.aggregate({ where: { createdAt: dateFilter }, _avg: { maxPlayersReached: true } }),
			this.prisma.room.groupBy({
				by: ["maxPlayersReached"],
				where: { createdAt: dateFilter },
				_count: { _all: true },
			}),
			this.prisma.match.findMany({
				where: { finishedAt: { not: null, gte: period.from, lt: period.to } },
				select: { startedAt: true, finishedAt: true },
			}),
			this.prisma.$queryRaw<{ avg_sec: number | null }[]>`
				SELECT AVG(EXTRACT(EPOCH FROM (d."createdAt" - c."createdAt"))) AS avg_sec
				FROM "ConnectionEvent" d
				JOIN "ConnectionEvent" c ON c."socketId" = d."socketId" AND c.type = 'CONNECT'
				WHERE d.type = 'DISCONNECT'
				  AND d."createdAt" BETWEEN ${period.from} AND ${period.to}
				  AND d."createdAt" > c."createdAt"
			`,
		]);

		const roomSizeDistribution = ROOM_SIZE_BUCKETS.map((bucket) => ({
			bucket,
			count: roomSizeRaw
				.filter((row) => (bucket === "6+" ? row.maxPlayersReached >= 6 : row.maxPlayersReached === Number(bucket)))
				.reduce((sum, row) => sum + row._count._all, 0),
		}));

		const avgMatchDurationSec = matches.length
			? matches.reduce((sum, m) => sum + (m.finishedAt!.getTime() - m.startedAt.getTime()) / 1000, 0) / matches.length
			: null;

		return {
			totalGamesPlayed,
			avgGamesPerRoom: roomsCreated ? totalGamesPlayed / roomsCreated : null,
			avgSessionDurationSec: avgSessionRaw[0]?.avg_sec ?? null,
			avgMatchDurationSec,
			avgPlayersPerRoom: avgPlayers._avg.maxPlayersReached,
			roomSizeDistribution,
		};
	}

	// ---------------------------------------------------------------------
	// Modes de jeu
	// ---------------------------------------------------------------------

	private async getModes(period: Period) {
		const dateFilter = { gte: period.from, lt: period.to };

		const [byOutcome, byDuration] = await Promise.all([
			this.prisma.gameSession.groupBy({
				by: ["gameId", "outcome"],
				where: { startedAt: dateFilter },
				_count: { _all: true },
			}),
			this.prisma.gameSession.groupBy({
				by: ["gameId"],
				where: { startedAt: dateFilter, durationSec: { not: null } },
				_avg: { durationSec: true },
			}),
		]);

		const avgDurationByGame = new Map(byDuration.map((row) => [row.gameId, row._avg.durationSec]));
		const totals = new Map<string, { launches: number; completed: number; abandoned: number }>();
		for (const row of byOutcome) {
			const entry = totals.get(row.gameId) ?? { launches: 0, completed: 0, abandoned: 0 };
			entry.launches += row._count._all;
			if (row.outcome === "COMPLETED") entry.completed += row._count._all;
			else if (row.outcome === "ABANDONED") entry.abandoned += row._count._all;
			totals.set(row.gameId, entry);
		}

		const totalLaunches = [...totals.values()].reduce((sum, v) => sum + v.launches, 0);
		const ranking = [...totals.entries()]
			.map(([gameId, v]) => {
				const resolved = v.completed + v.abandoned;
				return {
					gameId,
					launches: v.launches,
					usagePct: totalLaunches ? v.launches / totalLaunches : 0,
					avgDurationSec: avgDurationByGame.get(gameId) ?? null,
					abandonRate: resolved ? v.abandoned / resolved : null,
				};
			})
			.sort((a, b) => b.launches - a.launches);

		return { ranking };
	}

	// ---------------------------------------------------------------------
	// Retention (cohortes par date de premiere visite)
	// ---------------------------------------------------------------------

	private async getRetention(period: Period) {
		const [d1, d7, d30] = await Promise.all([
			this.retentionFor(1, period),
			this.retentionFor(7, period),
			this.retentionFor(30, period),
		]);
		return { d1, d7, d30 };
	}

	/**
	 * Parmi les visiteurs vus pour la premiere fois pendant `period` et pour
	 * qui N jours se sont ecoules depuis (sinon impossible a mesurer), quelle
	 * part s'est reconnectee exactement le jour N apres sa premiere visite.
	 * `days` est un entier interne fixe (1/7/30), jamais une entree utilisateur :
	 * l'interpoler dans le fragment d'intervalle est sans risque d'injection.
	 */
	private async retentionFor(days: number, period: Period): Promise<number | null> {
		const rows = await this.prisma.$queryRawUnsafe<{ eligible: bigint; retained: bigint }[]>(
			`
			SELECT
				COUNT(*) FILTER (WHERE v."firstSeenAt" <= NOW() - INTERVAL '${days} days') AS eligible,
				COUNT(*) FILTER (
					WHERE v."firstSeenAt" <= NOW() - INTERVAL '${days} days'
					AND EXISTS (
						SELECT 1 FROM "ConnectionEvent" ce
						WHERE ce."anonId" = v."anonId" AND ce.type = 'CONNECT'
						  AND ce."createdAt" >= v."firstSeenAt" + INTERVAL '${days} days'
						  AND ce."createdAt" < v."firstSeenAt" + INTERVAL '${days} days' + INTERVAL '1 day'
					)
				) AS retained
			FROM "Visitor" v
			WHERE v."firstSeenAt" BETWEEN $1 AND $2
			`,
			period.from,
			period.to,
		);
		const eligible = Number(rows[0]?.eligible ?? 0);
		const retained = Number(rows[0]?.retained ?? 0);
		return eligible ? retained / eligible : null;
	}

	// ---------------------------------------------------------------------
	// Viralite
	// ---------------------------------------------------------------------

	private async getVirality(period: Period) {
		const dateFilter = { gte: period.from, lt: period.to };
		const [invitesGenerated, joinedViaInvite] = await Promise.all([
			this.prisma.inviteGenerated.count({ where: { createdAt: dateFilter } }),
			this.prisma.roomJoin.count({ where: { createdAt: dateFilter, viaInvite: true } }),
		]);
		return {
			invitesGenerated,
			joinedViaInvite,
			inviteToJoinRate: invitesGenerated ? joinedViaInvite / invitesGenerated : null,
		};
	}
}
