import { Injectable } from '@nestjs/common';
import { Room, RoomSettings, RoundResult } from './interfaces/room.interface';
import { Player } from '../common/interfaces/player.interface';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans caracteres ambigus (0/O, 1/I)

const DEFAULT_ROUND_TIME_SEC = 35;
const DEFAULT_ROUNDS_BY_GAME: Record<string, number> = {
  'guess-champion': 10,
  'fusion-champions': 10,
  'turret-tank': 10,
  'whos-inting': 10,
  'tiktok-ranking': 7,
  'draft-battle': 1,
  'undercover-champion': 1,
  'intrus': 10,
  'vote-party': 5,
  'last-survivor': 1,
  'qui-suis-je': 1,
  'croquis': 1,
};

function defaultSettings(): RoomSettings {
  return {
    roundTimeSec: DEFAULT_ROUND_TIME_SEC,
    roundsByGame: { ...DEFAULT_ROUNDS_BY_GAME },
    loldleWordLength: null,
  };
}

function generateRoomCode(length = 5): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Etat des rooms en memoire (Map). Suffisant pour le MVP : pas besoin de
 * persistance tant qu'on n'a pas de comptes joueurs / historique cross-session.
 * A remplacer par un repository Prisma en Phase 1 sans changer l'interface publique.
 */
@Injectable()
export class RoomsService {
  private rooms = new Map<string, Room>();
  /** socketId -> code de room, pour retrouver vite la room d'un socket qui se deconnecte */
  private socketToRoom = new Map<string, string>();

  createRoom(hostSocketId: string, pseudo: string): Room {
    let code = generateRoomCode();
    while (this.rooms.has(code)) {
      code = generateRoomCode();
    }

    const host: Player = {
      id: hostSocketId,
      pseudo,
      isHost: true,
      connected: true,
      score: 0,
      joinedAt: new Date().toISOString(),
    };

    const room: Room = {
      code,
      hostId: hostSocketId,
      players: [host],
      status: 'lobby',
      currentGameId: null,
      roundHistory: [],
      createdAt: new Date().toISOString(),
      maxPlayers: 12,
      activeMix: null,
      settings: defaultSettings(),
    };

    this.rooms.set(code, room);
    this.socketToRoom.set(hostSocketId, code);
    return room;
  }

  joinRoom(socketId: string, code: string, pseudo: string): Room {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) {
      throw new Error('Room introuvable. Verifie le code.');
    }
    if (room.players.length >= room.maxPlayers) {
      throw new Error('Room pleine.');
    }
    if (room.players.some((p) => p.pseudo.toLowerCase() === pseudo.toLowerCase())) {
      throw new Error('Ce pseudo est deja pris dans cette room.');
    }

    const player: Player = {
      id: socketId,
      pseudo,
      isHost: false,
      connected: true,
      score: 0,
      joinedAt: new Date().toISOString(),
    };
    room.players.push(player);
    this.socketToRoom.set(socketId, room.code);
    return room;
  }

  leaveRoom(socketId: string): Room | undefined {
    const code = this.socketToRoom.get(socketId);
    if (!code) return undefined;
    const room = this.rooms.get(code);
    if (!room) return undefined;

    room.players = room.players.filter((p) => p.id !== socketId);
    this.socketToRoom.delete(socketId);

    if (room.players.length === 0) {
      this.rooms.delete(code);
      return undefined;
    }

    if (room.hostId === socketId) {
      const newHost = room.players[0];
      newHost.isHost = true;
      room.hostId = newHost.id;
    }

    return room;
  }

  renamePlayer(socketId: string, pseudo: string): Room | undefined {
    const room = this.getRoomBySocket(socketId);
    if (!room) return undefined;
    const player = room.players.find((p) => p.id === socketId);
    if (!player) return undefined;
    player.pseudo = pseudo;
    return room;
  }

  startGame(socketId: string, gameId: string): Room {
    const room = this.getRoomBySocket(socketId);
    if (!room) throw new Error('Tu n\'es dans aucune room.');
    if (room.hostId !== socketId) throw new Error('Seul l\'host peut lancer une partie.');

    room.status = 'in-game';
    room.currentGameId = gameId;
    return room;
  }

  endGame(socketId: string, summary = 'Retour au lobby.'): Room {
    const room = this.getRoomBySocket(socketId);
    if (!room) throw new Error('Tu n\'es dans aucune room.');
    if (room.hostId !== socketId) throw new Error('Seul l\'host peut terminer la manche.');
    if (room.activeMix && room.activeMix.status !== 'finished') {
      throw new Error('Party Mix en cours : impossible de skip avec Retour lobby.');
    }
    room.status = 'between-rounds';
    room.currentGameId = null;
    room.roundHistory.push({
      gameId: 'free-play',
      roundNumber: room.roundHistory.length + 1,
      scores: {},
      summary,
      finishedAt: new Date().toISOString(),
    });
    return room;
  }

  updateSettings(
    socketId: string,
    patch: {
      roundTimeSec?: number;
      roundsByGame?: Record<string, number>;
      loldleWordLength?: number | null;
    },
  ): Room {
    const room = this.getRoomBySocket(socketId);
    if (!room) throw new Error('Tu n\'es dans aucune room.');
    if (room.hostId !== socketId) throw new Error('Seul l\'host peut changer les reglages.');

    if (patch.roundTimeSec !== undefined) {
      room.settings.roundTimeSec = Math.max(15, Math.min(90, Math.round(patch.roundTimeSec)));
    }
    if (patch.roundsByGame) {
      for (const [gameId, rounds] of Object.entries(patch.roundsByGame)) {
        room.settings.roundsByGame[gameId] = Math.max(1, Math.min(30, Math.round(rounds)));
      }
    }
    if (patch.loldleWordLength !== undefined) {
      room.settings.loldleWordLength =
        patch.loldleWordLength === null || ![4, 5, 6].includes(patch.loldleWordLength)
          ? null
          : patch.loldleWordLength;
    }
    return room;
  }

  recordRoundResult(code: string, result: RoundResult): Room | undefined {
    const room = this.rooms.get(code);
    if (!room) return undefined;

    room.roundHistory.push(result);
    for (const [playerId, points] of Object.entries(result.scores)) {
      const player = room.players.find((p) => p.id === playerId);
      if (player) player.score += points;
    }
    // On garde le mini-jeu actif pour laisser le front afficher l'ecran de resultats.
    // L'host renvoie ensuite tout le monde au lobby via endGame().
    room.status = 'in-game';
    return room;
  }


  startMix(socketId: string, playlist: string[]): Room {
    const room = this.getRoomBySocket(socketId);
    if (!room) throw new Error('Tu n\'es dans aucune room.');
    if (room.hostId !== socketId) throw new Error('Seul l\'host peut lancer le Mix.');
    if (!playlist.length) throw new Error('Playlist Mix vide.');
    room.activeMix = {
      playlist,
      cursor: 0,
      total: playlist.length,
      currentGameId: null,
      currentRoundSize: 0,
      status: 'between-rounds',
      startedAt: new Date().toISOString(),
    };
    room.roundHistory = [];
    for (const player of room.players) player.score = 0;
    room.status = 'between-rounds';
    room.currentGameId = null;
    return room;
  }

  startNextMixSegment(socketId: string, roundSizeFor: (gameId: string) => number): Room {
    const room = this.getRoomBySocket(socketId);
    if (!room) throw new Error('Tu n\'es dans aucune room.');
    if (room.hostId !== socketId) throw new Error('Seul l\'host peut lancer la suite.');
    if (!room.activeMix) throw new Error('Aucune Party Mix active.');
    if (room.activeMix.cursor >= room.activeMix.playlist.length) {
      room.activeMix.status = 'finished';
      room.status = 'finished';
      room.currentGameId = null;
      return room;
    }
    const gameId = room.activeMix.playlist[room.activeMix.cursor];
    room.activeMix.cursor += 1;
    room.activeMix.currentGameId = gameId;
    room.activeMix.currentRoundSize = roundSizeFor(gameId);
    room.activeMix.status = 'running';
    room.status = 'in-game';
    room.currentGameId = gameId;
    return room;
  }

  finishMixSegment(code: string, result: RoundResult): Room | undefined {
    const room = this.recordRoundResult(code, result);
    if (!room) return undefined;
    if (room.activeMix) {
      room.activeMix.status = room.activeMix.cursor >= room.activeMix.total ? 'finished' : 'between-rounds';
      room.activeMix.currentGameId = null;
      room.activeMix.currentRoundSize = 0;
      room.status = room.activeMix.status === 'finished' ? 'finished' : 'between-rounds';
      room.currentGameId = null;
    }
    return room;
  }

  finishMix(socketId: string): Room {
    const room = this.getRoomBySocket(socketId);
    if (!room) throw new Error('Tu n\'es dans aucune room.');
    if (room.hostId !== socketId) throw new Error('Seul l\'host peut terminer le Mix.');
    room.activeMix = null;
    room.status = 'lobby';
    room.currentGameId = null;
    return room;
  }

  isMixRunning(room: Room): boolean {
    return !!room.activeMix && room.activeMix.status === 'running';
  }

  getRoomBySocket(socketId: string): Room | undefined {
    const code = this.socketToRoom.get(socketId);
    return code ? this.rooms.get(code) : undefined;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  /** Utilisateurs actifs "en ce moment" : lecture directe de l'etat en memoire, zero latence, toujours exact (contrairement a une requete BDD sur des events historiques). */
  getLiveStats(): { activeRooms: number; activePlayers: number } {
    let activePlayers = 0;
    for (const room of this.rooms.values()) activePlayers += room.players.length;
    return { activeRooms: this.rooms.size, activePlayers };
  }
}
