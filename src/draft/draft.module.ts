import { Module, OnModuleInit } from '@nestjs/common';
import { DraftService } from './draft.service';
import { DraftGateway } from './draft.gateway';
import { DraftController } from './draft.controller';
import { RoomsModule } from '../rooms/rooms.module';
import { GamesModule } from '../games/games.module';
import { GamesRegistryService } from '../games/games.registry';

@Module({
  imports: [RoomsModule, GamesModule],
  controllers: [DraftController],
  providers: [DraftService, DraftGateway],
})
export class DraftModule implements OnModuleInit {
  constructor(private readonly registry: GamesRegistryService) {}

  onModuleInit() {
    this.registry.register({
      id: 'draft-battle',
      label: 'Draft Battle',
      description: 'Composez une equipe de 5 champions avec un budget limite et affrontez les autres drafts.',
      minPlayers: 2,
      maxPlayers: 8,
    });
  }
}
