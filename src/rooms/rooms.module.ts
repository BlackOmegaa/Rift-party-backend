import { Module } from '@nestjs/common';
import { RoomsGateway } from './rooms.gateway';
import { RoomsService } from './rooms.service';
import { GamesModule } from '../games/games.module';

@Module({
  // GamesModule : lecture du minPlayers au lancement d'un jeu (garde-fou serveur).
  imports: [GamesModule],
  providers: [RoomsGateway, RoomsService],
  // RoomsGateway exporte pour AdminMetricsModule : snapshot des sockets
  // connectes (joueurs en ligne), etat que seul le gateway connait.
  exports: [RoomsService, RoomsGateway],
})
export class RoomsModule {}
