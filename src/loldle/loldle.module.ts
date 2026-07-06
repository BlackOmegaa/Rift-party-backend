import { Module, OnModuleInit } from '@nestjs/common';
import { LoldleService } from './loldle.service';
import { LoldleGateway } from './loldle.gateway';
import { RoomsModule } from '../rooms/rooms.module';
import { GamesModule } from '../games/games.module';
import { GamesRegistryService } from '../games/games.registry';

@Module({
  imports: [RoomsModule, GamesModule],
  providers: [LoldleService, LoldleGateway],
})
export class LoldleModule implements OnModuleInit {
  constructor(private readonly registry: GamesRegistryService) {}

  onModuleInit() {
    this.registry.register({
      id: 'loldle',
      label: 'Loldle',
      description:
        "Devine le champion mystere en 6 essais. Chaque lettre te dit si tu chauffes.",
      minPlayers: 1,
      maxPlayers: 12,
    });
  }
}
