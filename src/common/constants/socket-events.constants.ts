/**
 * Catalogue centralise des noms d'events Socket.IO.
 * Toujours passer par ces constantes (jamais de string en dur dans les gateways/services)
 * pour eviter les typos silencieuses entre back et front.
 */
export const ROOM_EVENTS = {
  CREATE: 'room:create',
  JOIN: 'room:join',
  LEAVE: 'room:leave',
  RENAME: 'room:rename',
  START_GAME: 'room:start-game',
  END_GAME: 'room:end-game',
  UPDATE_SETTINGS: 'room:update-settings',
  RESTART_GAME: 'room:restart-game',
  GAME_RESTARTED: 'room:game-restarted',

  STATE: 'room:state',
  PLAYER_JOINED: 'room:player-joined',
  PLAYER_LEFT: 'room:player-left',
  ERROR: 'room:error',
  GAME_STARTED: 'room:game-started',
  ROUND_FINISHED: 'room:round-finished',
  MIX_STARTED: 'party:started',
  MIX_NEXT: 'party:next',
  MIX_SEGMENT_COMPLETE: 'party:segment-complete',
} as const;

export const PARTY_EVENTS = {
  START: 'party:start',
  NEXT: 'party:next',
  SEGMENT_COMPLETE: 'party:segment-complete',
  STATE: 'party:state',
} as const;

export const DRAFT_EVENTS = {
  START: 'draft:start',
  SUBMIT: 'draft:submit',
  PLAYER_READY: 'draft:player-ready',
  RESULTS: 'draft:results',

  /** Tournoi (4+ joueurs) : diffuse a tout le monde l'etat complet du bracket a chaque changement. */
  BRACKET_STATE: 'draft:bracket-state',
  /** Tournoi : emit cible par joueur, son adversaire (ou clone) pour le round courant. */
  ROUND_MATCHUP: 'draft:round-matchup',
  /** Tournoi : diffuse a tout le monde des qu'un match individuel est resolu (avec son scenario). */
  MATCH_RESOLVED: 'draft:match-resolved',
  /** Tournoi : un joueur signale l'avancement de sa draft (picks par role) pour que les autres puissent le spec en direct. */
  DRAFT_PROGRESS: 'draft:draft-progress',
  /** Tournoi : diffusion a tout le monde de l'avancement de draft d'un match. */
  MATCH_DRAFT_PROGRESS: 'draft:match-draft-progress',

  /** Un client redemande son etat perso (bracket + son matchup courant) : resync apres reconnexion ou desync suspecte. Repond avec BRACKET_STATE + ROUND_MATCHUP cibles. */
  REQUEST_STATE: 'draft:request-state',

  /** Un duelliste signale qu'il a fini de regarder sa cinematique de combat (cle "single" ou "round-matchIndex"). */
  MATCH_SEEN: 'draft:match-seen',
  /** Diffuse a toute la room : le combat identifie par cette cle peut etre affiche partout (bracket, resume) sans spoiler qui que ce soit. */
  MATCH_REVEALED: 'draft:match-revealed',
} as const;

export const BRUME_EVENTS = {
  START: 'brume:start',
  REVEAL: 'brume:reveal',
  REVEAL_READY: 'brume:reveal-ready',
  REVEAL_PROGRESS: 'brume:reveal-progress',
  NIGHT_STARTED: 'brume:night-started',
  NIGHT_ACTION: 'brume:night-action',
  NIGHT_PROGRESS: 'brume:night-progress',
  DAWN: 'brume:dawn',
  DAY_STARTED: 'brume:day-started',
  VOTE_STARTED: 'brume:vote-started',
  VOTE: 'brume:vote',
  VOTE_PROGRESS: 'brume:vote-progress',
  VOTE_RESULT: 'brume:vote-result',
  CHAT_SEND: 'brume:chat-send',
  CHAT_MESSAGE: 'brume:chat-message',
  RESULTS: 'brume:results',
  REQUEST_STATE: 'brume:request-state',
  STATE: 'brume:state',
} as const;

export const LOLDLE_EVENTS = {
  START: 'loldle:start',
  GUESS: 'loldle:guess',
  GUESS_RESULT: 'loldle:guess-result',
  PROGRESS: 'loldle:progress',
  RESULTS: 'loldle:results',
  REQUEST_STATE: 'loldle:request-state',
  STATE: 'loldle:state',
} as const;

export const VOTE_PARTY_EVENTS = {
  START: 'voteparty:start',
  VOTE: 'voteparty:vote',
  VOTE_PROGRESS: 'voteparty:vote-progress',
  ROUND_RESULT: 'voteparty:round-result',
  NEXT: 'voteparty:next',
  QUESTION: 'voteparty:question',
  RESULTS: 'voteparty:results',
  REQUEST_STATE: 'voteparty:request-state',
  STATE: 'voteparty:state',
} as const;

export const CROQUIS_EVENTS = {
  START: 'croquis:start',
  SUBMIT_DRAWING: 'croquis:submit-drawing',
  DRAWING_PROGRESS: 'croquis:drawing-progress',
  GALLERY_ITEM: 'croquis:gallery-item',
  GUESS: 'croquis:guess',
  GUESS_PROGRESS: 'croquis:guess-progress',
  REVEAL: 'croquis:reveal',
  NEXT: 'croquis:next',
  RESULTS: 'croquis:results',
  REQUEST_STATE: 'croquis:request-state',
  STATE: 'croquis:state',
} as const;

export const UNDERCOVER_EVENTS = {
  START: 'undercover:start',
  REVEAL: 'undercover:reveal',
  REVEAL_READY: 'undercover:reveal-ready',
  REVEAL_PROGRESS: 'undercover:reveal-progress',
  TURN_STARTED: 'undercover:turn-started',
  SUBMIT_WORD: 'undercover:submit-word',
  WORD_SUBMITTED: 'undercover:word-submitted',
  VOTE_PHASE: 'undercover:vote-phase',
  VOTE: 'undercover:vote',
  VOTE_PROGRESS: 'undercover:vote-progress',
  RESULTS: 'undercover:results',
  REQUEST_STATE: 'undercover:request-state',
  STATE: 'undercover:state',
} as const;
