import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', service: 'rift-party-backend', time: new Date().toISOString() };
  }
}
