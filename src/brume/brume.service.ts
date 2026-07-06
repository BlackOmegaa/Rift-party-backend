import { Injectable } from '@nestjs/common';
import {
  BrumeAsheClue,
  BrumeChatChannel,
  BrumeChatKind,
  BrumeChatMessage,
  BrumeDeathRecord,
  BrumeNightActionType,
  BrumeNightRecap,
  BrumePhase,
  BrumePlayerRef,
  BrumeResult,
  BrumeRole,
  BrumeSnapshot,
  BrumeTeam,
  BrumeTeammateRef,
  BrumeVoteProgress,
  BRUME_ROLE_META,
} from './interfaces/brume.interface';

/** Duree par defaut si aucun reglage de room n'est fourni (ne devrait plus arriver, room.settings.roundTimeSec a toujours une valeur). */
const DEFAULT_ROUND_TIME_SEC = 45;

/** Nombre de champions predateurs distincts avant de dupliquer Warwick. */
function buildRoster(playerCount: number): BrumeRole[] {
  const predatorCount = Math.max(1, Math.floor(playerCount / 4));
  const roles: BrumeRole[] = ['warwick'];
  if (predatorCount >= 2) roles.push('fiddlesticks');
  for (let i = 2; i < predatorCount; i++) roles.push('warwick');
  roles.push('thresh', 'ashe');
  if (playerCount >= 8) roles.push('kindred');
  while (roles.length < playerCount) roles.push('poro');
  return roles.slice(0, playerCount);
}

interface BrumeNightState {
  warwickChoice: { action: 'consommer' | 'effroi'; targetId: string; by: string } | null;
  fiddlesticksNewMark: { targetId: string; by: string } | null;
  threshProtectTarget: string | null;
  asheScoutTarget: string | null;
  poroVotes: Map<string, string>;
  kindredAction: { action: 'mark_kindred' | 'hunt'; targetId?: string } | null;
  submittedPlayerIds: Set<string>;
}

interface BrumeSession {
  roomCode: string;
  players: BrumePlayerRef[];
  roles: Map<string, BrumeRole>;
  alive: Set<string>;
  dayNumber: number;
  phase: BrumePhase;
  phaseDeadline: number | null;
  phaseTimeout?: NodeJS.Timeout;
  /** Duree de base (nuit/vote) en secondes, pilotee par room.settings.roundTimeSec. Le jour dure 2x cette base (discussion + vote). */
  roundTimeSec: number;

  readyPlayerIds: Set<string>;

  night: BrumeNightState;
  pendingFiddlesticksMark: { targetId: string; by: string } | null;
  silencedForDay: Set<string>;

  kindredMarqueId: string | null;
  kindredHuntStreak: number;

  ashePrivateClue: BrumeAsheClue | null;
  mvpBonus: Map<string, number>;

  history: BrumeNightRecap[];
  lastDawn: BrumeNightRecap | null;

  votes: Map<string, string>;

  packChat: BrumeChatMessage[];
  dayChat: BrumeChatMessage[];
}

let chatMessageSeq = 0;

/**
 * Etat de "La Brume" en memoire, par room. Une session vit le temps d'une
 * manche (reveal -> boucle nuit/jour/vote -> resultats) puis est nettoyee
 * dans computeResults() (meme convention que UndercoverService).
 */
@Injectable()
export class BrumeService {
  private sessions = new Map<string, BrumeSession>();
  private lastResults = new Map<string, BrumeResult>();

  startSession(
    roomCode: string,
    players: BrumePlayerRef[],
    roundTimeSec: number = DEFAULT_ROUND_TIME_SEC,
  ): { players: BrumePlayerRef[] } {
    const shuffledRoles = buildRoster(players.length).sort(
      () => Math.random() - 0.5,
    );
    const roles = new Map<string, BrumeRole>();
    players.forEach((p, i) => roles.set(p.id, shuffledRoles[i]));

    this.lastResults.delete(roomCode);
    this.sessions.set(roomCode, {
      roomCode,
      players,
      roles,
      alive: new Set(players.map((p) => p.id)),
      dayNumber: 1,
      phase: 'reveal',
      phaseDeadline: null,
      roundTimeSec,
      readyPlayerIds: new Set(),
      night: this.emptyNightState(),
      pendingFiddlesticksMark: null,
      silencedForDay: new Set(),
      kindredMarqueId: null,
      kindredHuntStreak: 0,
      ashePrivateClue: null,
      mvpBonus: new Map(),
      history: [],
      lastDawn: null,
      votes: new Map(),
      packChat: [],
      dayChat: [],
    });
    return { players };
  }

  private emptyNightState(): BrumeNightState {
    return {
      warwickChoice: null,
      fiddlesticksNewMark: null,
      threshProtectTarget: null,
      asheScoutTarget: null,
      poroVotes: new Map(),
      kindredAction: null,
      submittedPlayerIds: new Set(),
    };
  }

  roleOf(roomCode: string, playerId: string): BrumeRole | undefined {
    return this.sessions.get(roomCode)?.roles.get(playerId);
  }

  teamOf(roomCode: string, playerId: string): BrumeTeam | undefined {
    const role = this.roleOf(roomCode, playerId);
    return role ? BRUME_ROLE_META[role].team : undefined;
  }

  private playersOfTeam(session: BrumeSession, team: BrumeTeam): BrumePlayerRef[] {
    return session.players.filter(
      (p) => BRUME_ROLE_META[session.roles.get(p.id)!].team === team,
    );
  }

  /**
   * Indicateur visuel demande cote produit : qui sont les autres "mechants"
   * (equipe predateurs) pour un joueur donne, avec leur role precis. Vide pour
   * tout le monde d'autre (circle/solo) : seuls les predateurs se reconnaissent
   * entre eux.
   */
  private teammatesFor(session: BrumeSession, playerId: string): BrumeTeammateRef[] {
    const team = BRUME_ROLE_META[session.roles.get(playerId)!]?.team;
    if (team !== 'predators') return [];
    return this.playersOfTeam(session, 'predators')
      .filter((p) => p.id !== playerId)
      .map((p) => ({ id: p.id, pseudo: p.pseudo, role: session.roles.get(p.id)! }));
  }

  /** Marque un joueur pret apres le reveal. Renvoie true quand tout le monde l'est. */
  markReady(roomCode: string, playerId: string): boolean {
    const session = this.sessions.get(roomCode);
    if (!session || session.phase !== 'reveal') return false;
    if (!session.roles.has(playerId)) return false;
    session.readyPlayerIds.add(playerId);
    return session.readyPlayerIds.size >= session.players.length;
  }

  revealProgress(roomCode: string): { ready: number; total: number } {
    const session = this.sessions.get(roomCode);
    return {
      ready: session?.readyPlayerIds.size ?? 0,
      total: session?.players.length ?? 0,
    };
  }

  beginNight(
    roomCode: string,
    onTimeout: (roomCode: string) => void,
  ): { deadline: number; durationMs: number; dayNumber: number } | undefined {
    const session = this.sessions.get(roomCode);
    if (!session) return undefined;
    session.phase = 'night';
    session.night = this.emptyNightState();
    session.ashePrivateClue = null;
    return this.scheduleTimeout(session, session.roundTimeSec * 1000, onTimeout);
  }

  private scheduleTimeout(
    session: BrumeSession,
    durationMs: number,
    onTimeout: (roomCode: string) => void,
  ): { deadline: number; durationMs: number; dayNumber: number } {
    if (session.phaseTimeout) clearTimeout(session.phaseTimeout);
    const deadline = Date.now() + durationMs;
    session.phaseDeadline = deadline;
    session.phaseTimeout = setTimeout(() => onTimeout(session.roomCode), durationMs);
    return { deadline, durationMs, dayNumber: session.dayNumber };
  }

  phaseOf(roomCode: string): BrumePhase | undefined {
    return this.sessions.get(roomCode)?.phase;
  }

  isAlive(roomCode: string, playerId: string): boolean {
    return !!this.sessions.get(roomCode)?.alive.has(playerId);
  }

  /** Traite une action de nuit envoyee par un joueur. Valide role + vivant + phase. */
  submitNightAction(
    roomCode: string,
    playerId: string,
    action: BrumeNightActionType,
    targetId: string | undefined,
  ): BrumeChatMessage | null {
    const session = this.sessions.get(roomCode);
    if (!session || session.phase !== 'night') {
      throw new Error("Ce n'est pas la phase de nuit.");
    }
    if (!session.alive.has(playerId)) throw new Error('Tu es elimine.');
    const role = session.roles.get(playerId);
    if (!role) throw new Error('Role introuvable.');
    // Pas de verrou "deja soumis" ici : un joueur peut changer d'avis autant de
    // fois qu'il veut tant que la nuit n'est pas resolue (voir demande produit).
    // Chaque case ci-dessous ECRASE simplement le choix precedent du meme type.

    const validTarget = (id?: string) =>
      !!id && session.alive.has(id) && id !== playerId;

    const pseudoOf = (id?: string) =>
      session.players.find((p) => p.id === id)?.pseudo ?? 'Quelqu un';

    let chatMessage: BrumeChatMessage | null = null;

    switch (action) {
      case 'consommer':
      case 'effroi': {
        if (role !== 'warwick') throw new Error("Cette action n'est pas la tienne.");
        if (!validTarget(targetId)) throw new Error('Cible invalide.');
        session.night.warwickChoice = { action, targetId: targetId!, by: playerId };
        chatMessage = this.pushChat(
          session,
          'pack',
          'vote',
          null,
          null,
          `${pseudoOf(playerId)} propose ${action === 'consommer' ? 'Morsure' : 'Effroi'} → ${pseudoOf(targetId)}`,
        );
        break;
      }
      case 'mark_fiddlesticks': {
        if (role !== 'fiddlesticks') throw new Error("Cette action n'est pas la tienne.");
        if (session.pendingFiddlesticksMark) {
          throw new Error('Fiddlesticks canalise deja sa proie.');
        }
        if (!validTarget(targetId)) throw new Error('Cible invalide.');
        session.night.fiddlesticksNewMark = { targetId: targetId!, by: playerId };
        chatMessage = this.pushChat(session, 'pack', 'vote', null, null, `${pseudoOf(playerId)} repère → ${pseudoOf(targetId)}`);
        break;
      }
      case 'protect': {
        if (role !== 'thresh') throw new Error("Cette action n'est pas la tienne.");
        if (!targetId || !session.alive.has(targetId)) throw new Error('Cible invalide.');
        session.night.threshProtectTarget = targetId;
        break;
      }
      case 'scout': {
        if (role !== 'ashe') throw new Error("Cette action n'est pas la tienne.");
        if (!validTarget(targetId)) throw new Error('Cible invalide.');
        session.night.asheScoutTarget = targetId!;
        const targetTeam = this.teamOf(roomCode, targetId!);
        const targetPseudo =
          session.players.find((p) => p.id === targetId)?.pseudo ?? 'Quelqu un';
        session.ashePrivateClue = {
          targetId: targetId!,
          targetPseudo,
          result: targetTeam === 'predators' ? 'ombre' : 'clarte',
        };
        break;
      }
      case 'huddle': {
        if (role !== 'poro') throw new Error("Cette action n'est pas la tienne.");
        if (!targetId || !session.alive.has(targetId)) throw new Error('Cible invalide.');
        session.night.poroVotes.set(playerId, targetId);
        break;
      }
      case 'mark_kindred': {
        if (role !== 'kindred') throw new Error("Cette action n'est pas la tienne.");
        if (!validTarget(targetId)) throw new Error('Cible invalide.');
        session.night.kindredAction = { action, targetId };
        break;
      }
      case 'hunt': {
        if (role !== 'kindred') throw new Error("Cette action n'est pas la tienne.");
        if (!session.kindredMarqueId) throw new Error('Choisis d\'abord ta Marque.');
        session.night.kindredAction = { action };
        break;
      }
      default:
        throw new Error('Action inconnue.');
    }
    session.night.submittedPlayerIds.add(playerId);
    return chatMessage;
  }

  /** Fil prive de la Nuee (predateurs) : log structure des choix + chat libre. */
  private pushChat(
    session: BrumeSession,
    channel: BrumeChatChannel,
    kind: BrumeChatKind,
    playerId: string | null,
    pseudo: string | null,
    text: string,
  ): BrumeChatMessage {
    const msg: BrumeChatMessage = {
      id: `msg-${++chatMessageSeq}`,
      channel,
      kind,
      playerId,
      pseudo,
      text,
      createdAt: Date.now(),
    };
    if (channel === 'pack') session.packChat.push(msg);
    else session.dayChat.push(msg);
    return msg;
  }

  sendChat(
    roomCode: string,
    playerId: string,
    channel: BrumeChatChannel,
    text: string,
  ): BrumeChatMessage {
    const session = this.sessions.get(roomCode);
    if (!session) throw new Error('Aucune manche en cours.');
    const trimmed = text.trim().slice(0, 240);
    if (!trimmed) throw new Error('Message vide.');
    const pseudo = session.players.find((p) => p.id === playerId)?.pseudo ?? 'Joueur';
    if (channel === 'pack') {
      const team = this.teamOf(roomCode, playerId);
      if (team !== 'predators') throw new Error("Tu n'as pas acces au fil de la Nuee.");
    }
    return this.pushChat(session, channel, 'text', playerId, pseudo, trimmed);
  }

  private logVote(
    session: BrumeSession,
    channel: BrumeChatChannel,
    voterPseudo: string,
    targetPseudo: string,
  ): BrumeChatMessage {
    return this.pushChat(
      session,
      channel,
      'vote',
      null,
      null,
      `${voterPseudo} vote ${targetPseudo}`,
    );
  }

  nightProgress(roomCode: string): { ready: number; total: number } {
    const session = this.sessions.get(roomCode);
    if (!session) return { ready: 0, total: 0 };
    const actors = session.players.filter((p) => {
      if (!session.alive.has(p.id)) return false;
      const role = session.roles.get(p.id)!;
      if (role === 'fiddlesticks' && session.pendingFiddlesticksMark) return false;
      return true;
    });
    return {
      ready: session.night.submittedPlayerIds.size,
      total: actors.length,
    };
  }

  /** Resolution complete d'une nuit : predateurs, Fiddlesticks differe, Kindred, Poro. */
  resolveNight(roomCode: string): {
    recap: BrumeNightRecap;
    victory: BrumeResult['winner'] | null;
  } {
    const session = this.sessions.get(roomCode);
    if (!session) throw new Error('Aucune manche en cours.');
    if (session.phaseTimeout) clearTimeout(session.phaseTimeout);

    const protectedId = session.night.threshProtectTarget;
    const attemptedTargets = new Set<string>();
    const deaths: BrumeDeathRecord[] = [];
    const kill = (targetId: string, cause: BrumeDeathRecord['cause']) => {
      attemptedTargets.add(targetId);
      if (!session.alive.has(targetId)) return false;
      if (targetId === protectedId) return false;
      session.alive.delete(targetId);
      const pseudo = session.players.find((p) => p.id === targetId)?.pseudo ?? 'Quelqu un';
      deaths.push({ playerId: targetId, pseudo, cause });
      return true;
    };

    let bloodTracePseudo: string | null = null;

    // 1. Warwick
    if (session.night.warwickChoice) {
      const { action, targetId, by } = session.night.warwickChoice;
      if (action === 'consommer') {
        const killed = kill(targetId, 'consommer');
        if (killed) {
          this.addMvpBonus(session.roomCode, by, 5);
          const living = [...session.alive];
          const decoy = living[Math.floor(Math.random() * living.length)];
          bloodTracePseudo =
            session.players.find((p) => p.id === decoy)?.pseudo ?? null;
        }
      } else if (action === 'effroi') {
        session.silencedForDay.add(targetId);
      }
    }

    // 2. Fiddlesticks : resout d'abord la marque en attente, puis en pose une nouvelle.
    if (session.pendingFiddlesticksMark) {
      const { targetId, by } = session.pendingFiddlesticksMark;
      const killed = kill(targetId, 'fiddlesticks');
      if (killed) this.addMvpBonus(session.roomCode, by, 5);
      // Si protegee, la Lanterne brise le rituel : Fiddlesticks devra tout recommencer.
      session.pendingFiddlesticksMark = null;
    }
    if (session.night.fiddlesticksNewMark && !session.pendingFiddlesticksMark) {
      session.pendingFiddlesticksMark = session.night.fiddlesticksNewMark;
    }

    // 3. Kindred
    if (session.night.kindredAction) {
      if (session.night.kindredAction.action === 'mark_kindred') {
        session.kindredMarqueId = session.night.kindredAction.targetId ?? null;
        session.kindredHuntStreak = 0;
      } else if (session.night.kindredAction.action === 'hunt' && session.kindredMarqueId) {
        const marqueId = session.kindredMarqueId;
        const marqueAlive = session.alive.has(marqueId);
        attemptedTargets.add(marqueId);
        if (marqueAlive && marqueId !== protectedId) {
          session.kindredHuntStreak += 1;
        }
        // Si protegee, le tour ne compte pas mais ne reset rien (design valide).
      }
    }

    // 4. Poro : signal collectif purement informatif.
    let poroWatch: BrumeNightRecap['poroWatch'] = null;
    if (session.night.poroVotes.size) {
      const tally = new Map<string, number>();
      for (const targetId of session.night.poroVotes.values()) {
        tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
      }
      const [topTarget] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
      if (topTarget) {
        const dangerDetected = deaths.some((d) => d.playerId === topTarget);
        const targetPseudo =
          session.players.find((p) => p.id === topTarget)?.pseudo ?? 'Quelqu un';
        poroWatch = { targetPseudo, dangerDetected };
      }
    }

    // Kindred gagne seul des que la Marque meurt de sa propre traque (2 nuits d'affilee).
    let kindredWon = false;
    const kindredEntry = session.players.find((p) => session.roles.get(p.id) === 'kindred');
    if (
      kindredEntry &&
      session.alive.has(kindredEntry.id) &&
      session.kindredMarqueId &&
      session.kindredHuntStreak >= 2 &&
      session.alive.has(session.kindredMarqueId)
    ) {
      kill(session.kindredMarqueId, 'kindred');
      kindredWon = true;
    }

    if (protectedId && attemptedTargets.has(protectedId)) {
      const threshPlayer = session.players.find((p) => session.roles.get(p.id) === 'thresh');
      if (threshPlayer) this.addMvpBonus(session.roomCode, threshPlayer.id, 5);
    }

    const recap: BrumeNightRecap = {
      day: session.dayNumber,
      deaths,
      bloodTracePseudo,
      silencedPseudos: [...session.silencedForDay]
        .map((id) => session.players.find((p) => p.id === id)?.pseudo)
        .filter((p): p is string => !!p),
      poroWatch,
    };
    session.history.push(recap);
    session.lastDawn = recap;

    let victory: BrumeResult['winner'] | null = null;
    if (kindredWon) victory = 'kindred';
    else victory = this.checkFactionVictory(session);

    return { recap, victory };
  }

  private checkFactionVictory(session: BrumeSession): BrumeResult['winner'] | null {
    const alivePredators = this.playersOfTeam(session, 'predators').filter((p) =>
      session.alive.has(p.id),
    ).length;
    const aliveOthers = session.players.filter(
      (p) =>
        session.alive.has(p.id) &&
        BRUME_ROLE_META[session.roles.get(p.id)!].team !== 'predators',
    ).length;
    if (alivePredators === 0) return 'circle';
    if (alivePredators >= aliveOthers) return 'predators';
    return null;
  }

  beginDay(
    roomCode: string,
    onTimeout: (roomCode: string) => void,
  ): { deadline: number; durationMs: number; dayNumber: number } | undefined {
    const session = this.sessions.get(roomCode);
    if (!session) return undefined;
    session.phase = 'day';
    return this.scheduleTimeout(session, session.roundTimeSec * 2 * 1000, onTimeout);
  }

  beginVote(
    roomCode: string,
    onTimeout: (roomCode: string) => void,
  ): { deadline: number; durationMs: number; dayNumber: number } | undefined {
    const session = this.sessions.get(roomCode);
    if (!session) return undefined;
    session.phase = 'vote';
    session.votes = new Map();
    return this.scheduleTimeout(session, session.roundTimeSec * 1000, onTimeout);
  }

  eligibleVoters(roomCode: string): string[] {
    const session = this.sessions.get(roomCode);
    if (!session) return [];
    return session.players
      .filter((p) => session.alive.has(p.id) && !session.silencedForDay.has(p.id))
      .map((p) => p.id);
  }

  submitVote(
    roomCode: string,
    voterId: string,
    targetId: string,
  ): { allVoted: boolean; chatMessage: BrumeChatMessage } {
    const session = this.sessions.get(roomCode);
    if (!session || session.phase !== 'vote') {
      throw new Error("Le vote n'est pas encore ouvert.");
    }
    if (!session.alive.has(voterId)) throw new Error('Tu es elimine.');
    if (session.silencedForDay.has(voterId)) throw new Error('Effroi : tu ne peux pas voter aujourd\'hui.');
    if (voterId === targetId) throw new Error('Tu ne peux pas voter pour toi-meme.');
    if (!session.alive.has(targetId)) throw new Error('Cible invalide.');
    // Pas de verrou "deja vote" : un joueur peut changer son vote autant de
    // fois qu'il veut tant que le temps du vote n'est pas ecoule (voir demande
    // produit). Voir aussi brume.gateway.ts::handleVote qui ne resout plus le
    // vote des que tout le monde a vote une fois, justement pour laisser cette
    // fenetre de changement d'avis jusqu'au timer.

    session.votes.set(voterId, targetId);
    const voterPseudo = session.players.find((p) => p.id === voterId)?.pseudo ?? 'Quelqu un';
    const targetPseudo = session.players.find((p) => p.id === targetId)?.pseudo ?? 'Quelqu un';
    const chatMessage = this.logVote(session, 'assembly', voterPseudo, targetPseudo);

    const eligible = this.eligibleVoters(roomCode);
    const allVoted = eligible.every((id) => session.votes.has(id));
    return { allVoted, chatMessage };
  }

  getVoteProgress(roomCode: string): BrumeVoteProgress {
    const session = this.sessions.get(roomCode);
    return {
      ready: session?.votes.size ?? 0,
      total: session ? this.eligibleVoters(roomCode).length : 0,
      votes: session ? Object.fromEntries(session.votes) : {},
    };
  }

  /** Resolution du vote de jour : majorite simple, egalite = personne n'est elimine. */
  resolveVote(roomCode: string): { eliminatedId: string | null; victory: BrumeResult['winner'] | null } {
    const session = this.sessions.get(roomCode);
    if (!session) throw new Error('Aucune manche en cours.');
    if (session.phaseTimeout) clearTimeout(session.phaseTimeout);

    session.silencedForDay = new Set();

    const tally = new Map<string, number>();
    for (const targetId of session.votes.values()) {
      tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
    }
    const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
    const topCount = sorted[0]?.[1] ?? 0;
    const topPlayers = sorted.filter(([, count]) => count === topCount);

    let eliminatedId: string | null = null;
    if (topPlayers.length === 1 && topCount > 0) {
      eliminatedId = topPlayers[0][0];
      session.alive.delete(eliminatedId);
    }

    session.dayNumber += 1;
    const victory = this.checkFactionVictory(session);
    return { eliminatedId, victory };
  }

  computeResults(roomCode: string, winner: BrumeResult['winner']): BrumeResult {
    const session = this.sessions.get(roomCode);
    if (!session) throw new Error('Aucune manche en cours.');
    if (session.phaseTimeout) clearTimeout(session.phaseTimeout);
    session.phase = 'results';

    const roles: BrumeResult['roles'] = {};
    for (const p of session.players) {
      const role = session.roles.get(p.id)!;
      roles[p.id] = {
        role,
        team: BRUME_ROLE_META[role].team,
        pseudo: p.pseudo,
        alive: session.alive.has(p.id),
      };
    }

    const scores: Record<string, number> = {};
    for (const p of session.players) {
      const role = session.roles.get(p.id)!;
      const team = BRUME_ROLE_META[role].team;
      const alive = session.alive.has(p.id);
      const bonus = session.mvpBonus.get(p.id) ?? 0;
      let base = 5;
      if (winner === 'kindred') {
        base = role === 'kindred' ? 30 : alive ? 8 : 3;
      } else if (team === winner) {
        base = alive ? 20 : 8;
      } else if (team === 'solo') {
        base = alive ? 8 : 3;
      } else {
        base = alive ? 4 : 0;
      }
      scores[p.id] = base + bonus;
    }

    const winnerLabel =
      winner === 'predators'
        ? 'Les prédateurs ont pris le contrôle du Cercle.'
        : winner === 'circle'
          ? 'Le Cercle a purgé la Brume.'
          : `${roles[session.players.find((p) => session.roles.get(p.id) === 'kindred')?.id ?? '']?.pseudo ?? 'Kindred'} a achevé sa traque en solitaire.`;

    const result: BrumeResult = {
      winner,
      summary: winnerLabel,
      roles,
      history: session.history,
      scores,
    };

    this.lastResults.set(roomCode, result);
    this.sessions.delete(roomCode);
    return result;
  }

  getSnapshot(roomCode: string, playerId: string): BrumeSnapshot {
    const session = this.sessions.get(roomCode);
    if (!session) {
      const results = this.lastResults.get(roomCode) ?? null;
      return {
        active: false,
        phase: 'results',
        dayNumber: 1,
        players: [],
        alivePlayerIds: [],
        myRole: null,
        myTeam: null,
        myChampion: null,
        myKit: null,
        myTeammates: [],
        myRevealReady: false,
        revealProgress: { ready: 0, total: 0 },
        phaseDeadline: null,
        phaseDurationMs: DEFAULT_ROUND_TIME_SEC * 1000,
        myNightActionSubmitted: false,
        myFiddlesticksPending: false,
        myKindredMarqueId: null,
        myKindredHuntStreak: 0,
        myAsheClue: null,
        lastDawn: null,
        packChat: [],
        dayChat: [],
        myVote: null,
        voteProgress: { ready: 0, total: 0, votes: {} },
        results,
      };
    }

    const role = session.roles.get(playerId) ?? null;
    const team = role ? BRUME_ROLE_META[role].team : null;
    const durationMs =
      session.phase === 'day'
        ? session.roundTimeSec * 2 * 1000
        : session.roundTimeSec * 1000;

    return {
      active: true,
      phase: session.phase,
      dayNumber: session.dayNumber,
      players: session.players,
      alivePlayerIds: [...session.alive],
      myRole: role,
      myTeam: team,
      myChampion: role ? BRUME_ROLE_META[role].champion : null,
      myKit: role ? BRUME_ROLE_META[role].kit : null,
      myTeammates: role ? this.teammatesFor(session, playerId) : [],
      myRevealReady: session.readyPlayerIds.has(playerId),
      revealProgress: this.revealProgress(roomCode),
      phaseDeadline: session.phaseDeadline,
      phaseDurationMs: durationMs,
      myNightActionSubmitted: session.night.submittedPlayerIds.has(playerId),
      myFiddlesticksPending: role === 'fiddlesticks' ? !!session.pendingFiddlesticksMark : false,
      myKindredMarqueId: role === 'kindred' ? session.kindredMarqueId : null,
      myKindredHuntStreak: role === 'kindred' ? session.kindredHuntStreak : 0,
      myAsheClue: role === 'ashe' ? session.ashePrivateClue : null,
      lastDawn: session.lastDawn,
      packChat: team === 'predators' ? session.packChat : [],
      dayChat: session.dayChat,
      myVote: session.votes.get(playerId) ?? null,
      voteProgress: this.getVoteProgress(roomCode),
      results: null,
    };
  }

  addMvpBonus(roomCode: string, playerId: string, points: number) {
    const session = this.sessions.get(roomCode);
    if (!session) return;
    session.mvpBonus.set(playerId, (session.mvpBonus.get(playerId) ?? 0) + points);
  }

  getPlayers(roomCode: string): BrumePlayerRef[] {
    return this.sessions.get(roomCode)?.players ?? [];
  }

  getRolePayload(roomCode: string, playerId: string) {
    const role = this.roleOf(roomCode, playerId);
    if (!role) return null;
    const meta = BRUME_ROLE_META[role];
    const session = this.sessions.get(roomCode);
    const teammates = session ? this.teammatesFor(session, playerId) : [];
    return { role, team: meta.team, champion: meta.champion, kit: meta.kit, teammates };
  }

  getPackMembers(roomCode: string): BrumePlayerRef[] {
    const session = this.sessions.get(roomCode);
    if (!session) return [];
    return this.playersOfTeam(session, 'predators');
  }
}
