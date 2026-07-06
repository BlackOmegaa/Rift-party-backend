import { Module } from "@nestjs/common";
import { PersistenceService } from "./persistence.service";
import { PersistenceListener } from "./persistence.listener";

@Module({
	providers: [PersistenceService, PersistenceListener],
	exports: [PersistenceService],
})
export class PersistenceModule {}
