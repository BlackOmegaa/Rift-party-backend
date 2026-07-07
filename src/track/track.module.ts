import { Module } from "@nestjs/common";
import { TrackController } from "./track.controller";

@Module({
	controllers: [TrackController],
})
export class TrackModule {}
