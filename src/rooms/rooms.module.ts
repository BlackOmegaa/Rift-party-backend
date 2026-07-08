import { Module } from '@nestjs/common';
import { RoomsGateway } from './rooms.gateway';
import { RoomsService } from './rooms.service';
import { PlayerAuthModule } from '../player-auth/player-auth.module';
import { GamesModule } from '../games/games.module';

@Module({
  // Reutilise le JwtModule (meme secret) expose par PlayerAuthModule pour
  // que RoomsGateway puisse verifier un token joueur optionnel au CREATE/JOIN
  // (voir resolveIsSubscriber) sans redeclarer de config JWT.
  // GamesModule : lecture du minPlayers au lancement d'un jeu (garde-fou serveur).
  imports: [PlayerAuthModule, GamesModule],
  providers: [RoomsGateway, RoomsService],
  // RoomsGateway exporte pour AdminMetricsModule : snapshot des sockets
  // connectes (joueurs en ligne), etat que seul le gateway connait.
  exports: [RoomsService, RoomsGateway],
})
export class RoomsModule {}
