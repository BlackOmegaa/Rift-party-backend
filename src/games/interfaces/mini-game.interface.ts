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
  /**
   * Mode en acces anticipe : visible et jouable uniquement si un abonne
   * Supporter est present dans la room (meme logique communautaire que le
   * contenu premium TikTok Ranking - filtre applique cote frontend dans
   * RoomComponent.secondaryGames()). Pour publier un nouveau mode en beta,
   * ajouter `beta: true` a son objet MiniGame lors de l'enregistrement
   * (register() dans le module du mini-jeu), puis retirer le flag quand le
   * mode sort officiellement.
   */
  beta?: boolean;
}
