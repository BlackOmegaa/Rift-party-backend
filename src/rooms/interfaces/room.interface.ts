import { Player } from '../../common/interfaces/player.interface';

export type RoomStatus = 'lobby' | 'in-game' | 'between-rounds' | 'finished';

export interface RoundResult {
  gameId: string;
  roundNumber: number;
  scores: Record<string, number>;
  summary: string;
  finishedAt: string;
  details?: any;
}

export interface ActiveMix {
  playlist: string[];
  cursor: number;
  total: number;
  currentGameId: string | null;
  currentRoundSize: number;
  status: 'running' | 'between-rounds' | 'finished';
  startedAt: string;
}

export interface RoomSettings {
  roundTimeSec: number;
  roundsByGame: Record<string, number>;
  /** null = toutes tailles (comportement par defaut), sinon 4/5/6 lettres. */
  loldleWordLength: number | null;
}

export interface Room {
  code: string;
  hostId: string;
  players: Player[];
  status: RoomStatus;
  currentGameId: string | null;
  roundHistory: RoundResult[];
  createdAt: string;
  maxPlayers: number;
  activeMix?: ActiveMix | null;
  settings: RoomSettings;
}
