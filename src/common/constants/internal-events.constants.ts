/**
 * Noms des events EventEmitter2 internes ajoutes pour la persistance/analytics
 * (distincts des events Socket.IO cotes client, deja centralises dans
 * socket-events.constants.ts). Memes conventions : toujours passer par ces
 * constantes plutot que des strings en dur.
 */
export const PERSISTENCE_EVENTS = {
	SOCKET_CONNECTED: "socket.connected",
	SOCKET_DISCONNECTED: "socket.disconnected",
	ROOM_CREATED: "room.created",
	ROOM_CLOSED: "room.closed",
	ROUND_FINISHED: "room.round-finished",
	/** Alias du nom d'event deja emis par RoomsGateway (pas un nouvel event) - liste ici pour la documentation. */
	GAME_STARTED: "room.game-started",
} as const;
