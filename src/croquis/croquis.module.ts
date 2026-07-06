import { Module, OnModuleInit } from '@nestjs/common';
import { CroquisService } from './croquis.service';
import { CroquisGateway } from './croquis.gateway';
import { RoomsModule } from '../rooms/rooms.module';
import { GamesModule } from '../games/games.module';
import { GamesRegistryService } from '../games/games.registry';

@Module({
  imports: [RoomsModule, GamesModule],
  providers: [CroquisService, CroquisGateway],
})
export class CroquisModule implements OnModuleInit {
  constructor(private readonly registry: GamesRegistryService) {}

  onModuleInit() {
    this.registry.register({
      id: 'croquis',
      label: 'Croquis',
      description:
        'Chacun dessine son champion secret, puis les oeuvres defilent : devinez qui se cache derriere chaque croquis.',
      minPlayers: 3,
      maxPlayers: 12,
    });
  }
}
