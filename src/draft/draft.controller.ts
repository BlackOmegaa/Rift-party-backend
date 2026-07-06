import { Controller, Get } from '@nestjs/common';
import { DraftService } from './draft.service';

@Controller('draft')
export class DraftController {
  constructor(private readonly draftService: DraftService) {}

  @Get('champions')
  getChampions() {
    return this.draftService.getChampionsPool();
  }
}
