export interface Player {
  id: string;
  pseudo: string;
  isHost: boolean;
  connected: boolean;
  score: number;
  joinedAt: string;
}
