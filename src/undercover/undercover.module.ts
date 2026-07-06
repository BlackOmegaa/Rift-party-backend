import { Module } from '@nestjs/common';
import { UndercoverService } from './undercover.service';
import { UndercoverGateway } from './undercover.gateway';
import { RoomsModule } from '../rooms/rooms.module';
import { GamesModule } from '../games/games.module';

/**
 * L'entree de catalogue 'undercover-champion' est deja enregistree par
 * PartyModule : ce module ne fournit que le moteur de jeu (gateway + service).
 */
@Module({
  imports: [RoomsModule, GamesModule],
  providers: [UndercoverService, UndercoverGateway],
})
export class UndercoverModule {}
