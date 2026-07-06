import { Module, OnModuleInit } from '@nestjs/common';
import { BrumeService } from './brume.service';
import { BrumeGateway } from './brume.gateway';
import { RoomsModule } from '../rooms/rooms.module';
import { GamesModule } from '../games/games.module';
import { GamesRegistryService } from '../games/games.registry';

@Module({
  imports: [RoomsModule, GamesModule],
  providers: [BrumeService, BrumeGateway],
})
export class BrumeModule implements OnModuleInit {
  constructor(private readonly registry: GamesRegistryService) {}

  onModuleInit() {
    this.registry.register({
      id: 'brume',
      label: 'La Brume',
      description:
        'Un mal rôde dans le Cercle. Chassez, protégez et votez, nuit après nuit, jusqu\'à l\'aube décisive.',
      minPlayers: 8,
      maxPlayers: 12,
    });
  }
}
