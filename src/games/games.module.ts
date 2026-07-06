import { Module } from '@nestjs/common';
import { GamesRegistryService } from './games.registry';
import { GamesController } from './games.controller';

@Module({
  controllers: [GamesController],
  providers: [GamesRegistryService],
  exports: [GamesRegistryService],
})
export class GamesModule {}
