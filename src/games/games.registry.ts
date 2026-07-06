import { Injectable } from '@nestjs/common';
import { MiniGame } from './interfaces/mini-game.interface';

/**
 * Registre central des mini-jeux disponibles.
 * Pour ajouter un mini-jeu : appeler `register()` depuis le module du mini-jeu
 * (dans son constructeur, ou via onModuleInit). Rien d'autre a modifier ici.
 */
@Injectable()
export class GamesRegistryService {
  private games = new Map<string, MiniGame>();

  register(game: MiniGame) {
    this.games.set(game.id, game);
  }

  getAll(): MiniGame[] {
    return Array.from(this.games.values());
  }

  get(id: string): MiniGame | undefined {
    return this.games.get(id);
  }
}
