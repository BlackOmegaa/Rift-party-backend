/**
 * Contrat que doit respecter chaque mini-jeu pour apparaitre dans le catalogue
 * et etre lancable depuis un lobby. Un module de mini-jeu (ex: DraftModule)
 * enregistre une entree ici ; le coeur (RoomsModule) n'a jamais besoin de
 * connaitre le detail d'implementation d'un mini-jeu precis.
 */
export interface MiniGame {
  id: string;
  label: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
}
