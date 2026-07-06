import { Module, OnModuleInit } from '@nestjs/common';
import { WhoamiService } from './whoami.service';
import { WhoamiGateway } from './whoami.gateway';
import { RoomsModule } from '../rooms/rooms.module';
import { GamesModule } from '../games/games.module';
import { GamesRegistryService } from '../games/games.registry';

@Module({
  imports: [RoomsModule, GamesModule],
  providers: [WhoamiService, WhoamiGateway],
})
export class WhoamiModule implements OnModuleInit {
  constructor(private readonly registry: GamesRegistryService) {}

  onModuleInit() {
    this.registry.register({
      id: 'qui-suis-je',
      label: 'Qui suis-je ?',
      description:
        'Chacun recoit un champion secret visible des autres. Pose tes questions a voix haute, le lobby repond Oui ou Non.',
      minPlayers: 3,
      maxPlayers: 12,
    });
  }
}
