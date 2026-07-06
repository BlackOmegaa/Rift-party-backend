import { Controller, Get } from '@nestjs/common';
import { GamesRegistryService } from './games.registry';

@Controller('games')
export class GamesController {
  constructor(private readonly registry: GamesRegistryService) {}

  @Get()
  list() {
    return this.registry.getAll();
  }
}
