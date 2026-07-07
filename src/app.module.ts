import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { RoomsModule } from './rooms/rooms.module';
import { GamesModule } from './games/games.module';
import { DraftModule } from './draft/draft.module';
import { PartyModule } from './party/party.module';
import { UndercoverModule } from './undercover/undercover.module';
import { BrumeModule } from './brume/brume.module';
import { LoldleModule } from './loldle/loldle.module';
import { VotePartyModule } from './vote-party/vote-party.module';
import { LastSurvivorModule } from './last-survivor/last-survivor.module';
import { WhoamiModule } from './whoami/whoami.module';
import { CroquisModule } from './croquis/croquis.module';
import { PrismaModule } from './prisma/prisma.module';
import { PersistenceModule } from './persistence/persistence.module';
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { AdminMetricsModule } from './admin-metrics/admin-metrics.module';
import { EntitlementModule } from './entitlement/entitlement.module';
import { PlayerAuthModule } from './player-auth/player-auth.module';
import { BillingModule } from './billing/billing.module';
import { TrackModule } from './track/track.module';

@Module({
  imports: [
    // Charge backend/.env (DATABASE_URL, JWT_SECRET, ADMIN_SEED_*...), global
    // pour ne pas avoir a le reimporter dans chaque module.
    ConfigModule.forRoot({ isGlobal: true }),
    // Bus d'evenements internes : permet a RoomsModule (coeur) de notifier
    // "une partie demarre" SANS connaitre les modules de mini-jeu qui ecoutent.
    // C'est ce qui garde le coeur decouple de chaque mini-jeu (cf. ARCHITECTURE.md).
    EventEmitterModule.forRoot(),
    // Garde-fou global anti brute-force sur les routes HTTP (les gateways
    // socket.io ne passent pas par ce guard). Limite generale genereuse ; la
    // route /admin/login a sa propre limite plus stricte via @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    EntitlementModule,
    RoomsModule,
    GamesModule,
    DraftModule,
    PartyModule,
    UndercoverModule,
    BrumeModule,
    LoldleModule,
    VotePartyModule,
    LastSurvivorModule,
    WhoamiModule,
    CroquisModule,
    PersistenceModule,
    AdminAuthModule,
    AdminMetricsModule,
    PlayerAuthModule,
    BillingModule,
    TrackModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
