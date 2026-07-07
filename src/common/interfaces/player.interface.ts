export interface Player {
  id: string;
  pseudo: string;
  isHost: boolean;
  connected: boolean;
  score: number;
  joinedAt: string;
  /** Statut Supporter au moment de l'entree en room (snapshot, voir RoomsGateway.resolveIsSubscriber). */
  isSubscriber: boolean;
}
