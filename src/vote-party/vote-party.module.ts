import { Module, OnModuleInit } from '@nestjs/common';
import { VotePartyService } from './vote-party.service';
import { VotePartyGateway } from './vote-party.gateway';
import { RoomsModule } from '../rooms/rooms.module';
import { GamesModule } from '../games/games.module';
import { GamesRegistryService } from '../games/games.registry';

@Module({
  imports: [RoomsModule, GamesModule],
  providers: [VotePartyService, VotePartyGateway],
})
export class VotePartyModule implements OnModuleInit {
  constructor(private readonly registry: GamesRegistryService) {}

  onModuleInit() {
    this.registry.register({
      id: 'vote-party',
      label: 'Vote Party',
      description:
        'Une question, un vote secret : designez le joueur du lobby qui colle le mieux et suivez la majorite.',
      minPlayers: 3,
      maxPlayers: 12,
    });
  }
}
