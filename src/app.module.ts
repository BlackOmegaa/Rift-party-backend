import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
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

@Module({
  imports: [
    // Charge backend/.env (DATABASE_URL, JWT_SECRET, ADMIN_SEED_*...), global
    // pour ne pas avoir a le reimporter dans chaque module.
    ConfigModule.forRoot({ isGlobal: true }),
    // Bus d'evenements internes : permet a RoomsModule (coeur) de notifier
    // "une partie demarre" SANS connaitre les modules de mini-jeu qui ecoutent.
    // C'est ce qui garde le coeur decouple de chaque mini-jeu (cf. ARCHITECTURE.md).
    EventEmitterModule.forRoot(),
    PrismaModule,
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
  ],
  controllers: [AppController],
})
export class AppModule {}
