import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RoomsService } from "../rooms/rooms.service";
import { RoomsGateway } from "../rooms/rooms.gateway";

const DAY_MS = 24 * 60 * 60 * 1000;
const ROOM_SIZE_BUCKETS = ["2", "3", "4", "5", "6+"] as const;

interface Period {
	from: Date;
	to: Date;
}

/**
 * anonIds marques `Visitor.excluded` (appareils de l'equipe) et codes des
 * rooms qu'ils ont creees : calcules une fois par requete de dashboard puis
 * passes a chaque section. Les stats par visiteur filtrent sur `anonIds` ;
 * les stats par room (rounds, matches, tailles) filtrent sur `roomCodes`
 * (une room de test creee par l'admin est du bruit, meme si des inconnus
 * l'ont rejointe).
 */
interface Exclusion {
	anonIds: string[];
	roomCodes: string[];
}

/**
 * KPI produit pour le dashboard admin, organises par les sections du roadmap
 * (acquisition / conversion / engagement / modes / retention / viralite /
 * monetisation). Chaque section est une methode privee independante : ni le
 * controller ni le frontend n'ont a connaitre l'organisation interne des
 * requetes, seulement la forme du JSON retourne par `getSummary`.
 *
 * Choix de perf : les agregations simples passent par l'API Prisma
 * (groupBy/aggregate, deja indexees) ; les calculs qui melangent plusieurs
 * tables ou font de l'arithmetique de dates (duree de session, retention par
 * cohorte) passent par du SQL brut ($queryRaw) plutot que de rapatrier les
 * lignes en Node pour les recorreler a la main.
 *
 * Dans les requetes SQL brutes, l'exclusion des appareils de l'equipe passe
 * par un NOT EXISTS sur Visitor.excluded (aucun parametre a injecter) ; dans
 * les requetes Prisma, par un `notIn` sur la petite liste precalculee.
 */
@Injectable()
export class AdminMetricsService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly roomsService: RoomsService,
		private readonly roomsGateway: RoomsGateway,
	) {}

	async getSummary(from?: Date, to?: Date) {
		const period: Period = {
			from: from ?? new Date(Date.now() - 30 * DAY_MS),
			to: to ?? new Date(),
		};

		const exclusion = await this.getExclusion();

		const [live, todayVsYesterday, acquisition, conversion, engagement, modes, retention, virality, monetization] =
			await Promise.all([
				this.getLive(exclusion),
				this.getTodayVsYesterday(exclusion),
				this.getAcquisition(period),
				this.getConversion(period, exclusion),
				this.getEngagement(period, exclusion),
				this.getModes(period, exclusion),
				this.getRetention(period),
				this.getVirality(period, exclusion),
				this.getMonetization(period, exclusion),
			]);

		return {
			period: { from: period.from.toISOString(), to: period.to.toISOString() },
			meta: { excludedVisitors: exclusion.anonIds.length },
			live,
			todayVsYesterday,
			acquisition,
			conversion,
			engagement,
			modes,
			retention,
			virality,
			monetization,
		};
	}

	/** Signalements des joueurs, plus recents d'abord (les ouverts avant les traites). */
	async getBugReports() {
		const reports = await this.prisma.bugReport.findMany({
			orderBy: [{ status: "asc" }, { createdAt: "desc" }],
			take: 200,
		});
		const openCount = await this.prisma.bugReport.count({ where: { status: "OPEN" } });
		return { openCount, reports };
	}

	/** Bascule un signalement traite/a traiter depuis la console. */
	async setBugReportStatus(id: string, status: "OPEN" | "DONE") {
		try {
			return await this.prisma.bugReport.update({ where: { id }, data: { status } });
		} catch {
			throw new NotFoundException("Signalement introuvable.");
		}
	}

	/** Marque un appareil (anonId) comme appartenant a l'equipe : exclu de toutes les stats. */
	async excludeVisitor(anonId: string) {
		await this.prisma.visitor.upsert({
			where: { anonId },
			create: { anonId, excluded: true },
			update: { excluded: true },
		});
		const totalExcluded = await this.prisma.visitor.count({ where: { excluded: true } });
		return { excluded: true, totalExcluded };
	}

	private async getExclusion(): Promise<Exclusion> {
		const excludedVisitors = await this.prisma.visitor.findMany({
			where: { excluded: true },
			select: { anonId: true },
		});
		const anonIds = excludedVisitors.map((v) => v.anonId);
		if (!anonIds.length) return { anonIds: [], roomCodes: [] };

		const hostedRooms = await this.prisma.roomJoin.findMany({
			where: { isHost: true, anonId: { in: anonIds } },
			select: { roomCode: true },
			distinct: ["roomCode"],
		});
		return { anonIds, roomCodes: hostedRooms.map((r) => r.roomCode) };
	}

	// ---------------------------------------------------------------------
	// Live (etat en memoire, pas de periode)
	// ---------------------------------------------------------------------

	private async getLive(exclusion: Exclusion) {
		const { activeRooms, activePlayers } = this.roomsService.getLiveStats();
		// Joueurs en ligne = sockets connectes en ce moment (site ouvert, en room
		// ou non), appareils de l'equipe retires. Compte les appareils distincts
		// (anonId) : deux onglets du meme navigateur = un seul joueur.
		const excludedSet = new Set(exclusion.anonIds);
		const online = this.roomsGateway.getOnlineSnapshot().filter((s) => !excludedSet.has(s.anonId));
		const onlinePlayersNow = new Set(online.map((s) => s.anonId)).size;
		const dayAgo = new Date(Date.now() - DAY_MS);
		const activeToday = await this.prisma.connectionEvent.findMany({
			where: { type: "CONNECT", createdAt: { gte: dayAgo }, anonId: { notIn: exclusion.anonIds } },
			select: { anonId: true },
			distinct: ["anonId"],
		});
		return {
			onlinePlayersNow,
			activeRoomsNow: activeRooms,
			activePlayersNow: activePlayers,
			activeUsersToday: activeToday.length,
		};
	}

	/** Comparaison jour calendaire vs veille, toujours relative a "maintenant" (independante du filtre de periode choisi dans le dashboard). */
	private async getTodayVsYesterday(exclusion: Exclusion) {
		const now = new Date();
		const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const yesterdayStart = new Date(todayStart.getTime() - DAY_MS);

		const [activeUsersToday, activeUsersYesterday, newVisitorsToday, newVisitorsYesterday] = await Promise.all([
			this.countDistinctAnonId({ type: "CONNECT", createdAt: { gte: todayStart } }, exclusion),
			this.countDistinctAnonId({ type: "CONNECT", createdAt: { gte: yesterdayStart, lt: todayStart } }, exclusion),
			this.prisma.visitor.count({ where: { firstSeenAt: { gte: todayStart }, excluded: false } }),
			this.prisma.visitor.count({ where: { firstSeenAt: { gte: yesterdayStart, lt: todayStart }, excluded: false } }),
		]);

		return {
			activeUsers: { today: activeUsersToday, yesterday: activeUsersYesterday },
			newVisitors: { today: newVisitorsToday, yesterday: newVisitorsYesterday },
		};
	}

	private async countDistinctAnonId(
		where: { type: "CONNECT"; createdAt: { gte: Date; lt?: Date } },
		exclusion: Exclusion,
	) {
		const rows = await this.prisma.connectionEvent.findMany({
			where: { ...where, anonId: { notIn: exclusion.anonIds } },
			select: { anonId: true },
			distinct: ["anonId"],
		});
		return rows.length;
	}

	// ---------------------------------------------------------------------
	// Acquisition
	// ---------------------------------------------------------------------

	private async getAcquisition(period: Period) {
		const [uniqueRows, newVsReturning, dailySeries, bySource] = await Promise.all([
			this.prisma.$queryRaw<{ unique_visitors: bigint }[]>`
				SELECT COUNT(DISTINCT ce."anonId") AS unique_visitors
				FROM "ConnectionEvent" ce
				WHERE ce.type = 'CONNECT' AND ce."createdAt" BETWEEN ${period.from} AND ${period.to}
				  AND NOT EXISTS (SELECT 1 FROM "Visitor" vx WHERE vx."anonId" = ce."anonId" AND vx."excluded")
			`,
			this.prisma.$queryRaw<{ new_count: bigint; returning_count: bigint }[]>`
				SELECT
					COUNT(DISTINCT ce."anonId") FILTER (WHERE v."firstSeenAt" >= ${period.from}) AS new_count,
					COUNT(DISTINCT ce."anonId") FILTER (WHERE v."firstSeenAt" IS NULL OR v."firstSeenAt" < ${period.from}) AS returning_count
				FROM "ConnectionEvent" ce
				LEFT JOIN "Visitor" v ON v."anonId" = ce."anonId"
				WHERE ce.type = 'CONNECT' AND ce."createdAt" BETWEEN ${period.from} AND ${period.to}
				  AND (v."anonId" IS NULL OR NOT v."excluded")
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
				  AND (v."anonId" IS NULL OR NOT v."excluded")
				GROUP BY 1
				ORDER BY 1
			`,
			this.prisma.$queryRaw<{ source: string; count: bigint }[]>`
				SELECT COALESCE(v."acquisitionSource", 'inconnu') AS source, COUNT(*) AS count
				FROM "Visitor" v
				WHERE v."firstSeenAt" BETWEEN ${period.from} AND ${period.to}
				  AND NOT v."excluded"
				GROUP BY 1
				ORDER BY 2 DESC
			`,
		]);

		const uniqueVisitors = Number(uniqueRows[0]?.unique_visitors ?? 0);
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

	private async getConversion(period: Period, exclusion: Exclusion) {
		const dateFilter = { gte: period.from, lt: period.to };
		const [roomsCreated, playersJoinedRows, gameStartedRows, uniqueVisitors] = await Promise.all([
			// Compte via RoomJoin(isHost) plutot que Room : Room n'a pas d'anonId,
			// impossible d'en exclure les rooms de test de l'equipe autrement.
			this.prisma.roomJoin.count({
				where: { createdAt: dateFilter, isHost: true, anonId: { notIn: exclusion.anonIds } },
			}),
			this.prisma.roomJoin.findMany({
				where: { createdAt: dateFilter, anonId: { notIn: exclusion.anonIds } },
				select: { anonId: true },
				distinct: ["anonId"],
			}),
			this.prisma.gameSession.findMany({
				where: { startedAt: dateFilter, anonId: { notIn: exclusion.anonIds } },
				select: { anonId: true },
				distinct: ["anonId"],
			}),
			this.countDistinctAnonId({ type: "CONNECT", createdAt: { gte: period.from, lt: period.to } }, exclusion),
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

	private async getEngagement(period: Period, exclusion: Exclusion) {
		const dateFilter = { gte: period.from, lt: period.to };
		const roomFilter = { code: { notIn: exclusion.roomCodes } };

		const [totalGamesPlayed, roomsCreated, avgPlayers, roomSizeRaw, matches, avgSessionRaw] = await Promise.all([
			this.prisma.round.count({ where: { finishedAt: dateFilter, match: { room: roomFilter } } }),
			this.prisma.room.count({ where: { createdAt: dateFilter, ...roomFilter } }),
			this.prisma.room.aggregate({
				where: { createdAt: dateFilter, ...roomFilter },
				_avg: { maxPlayersReached: true },
			}),
			this.prisma.room.groupBy({
				by: ["maxPlayersReached"],
				where: { createdAt: dateFilter, ...roomFilter },
				_count: { _all: true },
			}),
			this.prisma.match.findMany({
				where: { finishedAt: { not: null, gte: period.from, lt: period.to }, room: roomFilter },
				select: { startedAt: true, finishedAt: true },
			}),
			this.prisma.$queryRaw<{ avg_sec: number | null }[]>`
				SELECT AVG(EXTRACT(EPOCH FROM (d."createdAt" - c."createdAt"))) AS avg_sec
				FROM "ConnectionEvent" d
				JOIN "ConnectionEvent" c ON c."socketId" = d."socketId" AND c.type = 'CONNECT'
				WHERE d.type = 'DISCONNECT'
				  AND d."createdAt" BETWEEN ${period.from} AND ${period.to}
				  AND d."createdAt" > c."createdAt"
				  AND NOT EXISTS (SELECT 1 FROM "Visitor" vx WHERE vx."anonId" = d."anonId" AND vx."excluded")
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

	private async getModes(period: Period, exclusion: Exclusion) {
		const where = {
			startedAt: { gte: period.from, lt: period.to },
			anonId: { notIn: exclusion.anonIds },
		};

		const [byOutcome, byDuration] = await Promise.all([
			this.prisma.gameSession.groupBy({
				by: ["gameId", "outcome"],
				where,
				_count: { _all: true },
			}),
			this.prisma.gameSession.groupBy({
				by: ["gameId"],
				where: { ...where, durationSec: { not: null } },
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
			  AND NOT v."excluded"
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

	private async getVirality(period: Period, exclusion: Exclusion) {
		const dateFilter = { gte: period.from, lt: period.to };
		const [invitesGenerated, joinedViaInvite] = await Promise.all([
			this.prisma.inviteGenerated.count({
				where: { createdAt: dateFilter, anonId: { notIn: exclusion.anonIds } },
			}),
			this.prisma.roomJoin.count({
				where: { createdAt: dateFilter, viaInvite: true, anonId: { notIn: exclusion.anonIds } },
			}),
		]);
		return {
			invitesGenerated,
			joinedViaInvite,
			inviteToJoinRate: invitesGenerated ? joinedViaInvite / invitesGenerated : null,
		};
	}

	// ---------------------------------------------------------------------
	// Monetisation (funnel donation + attribution des conversions)
	// ---------------------------------------------------------------------

	private async getMonetization(period: Period, exclusion: Exclusion) {
		const dateFilter = { gte: period.from, lt: period.to };
		// `notIn` ne matche jamais NULL, donc NOT(in) garde les events sans anonId
		// (ex. clic Ko-fi depuis un navigateur au localStorage vide) : voulu.
		const notExcluded = exclusion.anonIds.length ? { NOT: { anonId: { in: exclusion.anonIds } } } : {};

		const [steps, bySource] = await Promise.all([
			this.prisma.funnelEvent.groupBy({
				by: ["kind", "step"],
				where: { createdAt: dateFilter, ...notExcluded },
				_count: { _all: true },
			}),
			this.prisma.$queryRaw<{ source: string; donation_clicks: bigint }[]>`
				SELECT
					COALESCE(v."acquisitionSource", 'inconnu') AS source,
					COUNT(*) FILTER (WHERE fe.kind = 'DONATION' AND fe.step = 'CTA_CLICKED') AS donation_clicks
				FROM "FunnelEvent" fe
				LEFT JOIN "Visitor" v ON v."anonId" = fe."anonId"
				WHERE fe."createdAt" BETWEEN ${period.from} AND ${period.to}
				  AND (v."anonId" IS NULL OR NOT v."excluded")
				GROUP BY 1
				ORDER BY 2 DESC
			`,
		]);

		const count = (kind: "DONATION", step: string) =>
			steps
				.filter((row) => row.kind === kind && row.step === step)
				.reduce((sum, row) => sum + row._count._all, 0);

		return {
			donationClicks: count("DONATION", "CTA_CLICKED"),
			bySource: bySource
				.map((row) => ({
					source: row.source,
					donationClicks: Number(row.donation_clicks),
				}))
				.filter((row) => row.donationClicks),
		};
	}
}
