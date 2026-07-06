import { Module, OnModuleInit } from '@nestjs/common';
import { LastSurvivorService } from './last-survivor.service';
import { LastSurvivorGateway } from './last-survivor.gateway';
import { RoomsModule } from '../rooms/rooms.module';
import { GamesModule } from '../games/games.module';
import { GamesRegistryService } from '../games/games.registry';

@Module({
  imports: [RoomsModule, GamesModule],
  providers: [LastSurvivorService, LastSurvivorGateway],
})
export class LastSurvivorModule implements OnModuleInit {
  constructor(private readonly registry: GamesRegistryService) {}

  onModuleInit() {
    this.registry.register({
      id: 'last-survivor',
      label: 'Last Survivor',
      description:
        'Une categorie, huit candidats : eliminez-en un par vote a chaque manche jusqu\'au dernier survivant.',
      minPlayers: 2,
      maxPlayers: 12,
    });
  }
}
