import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class BugReportDto {
	@IsString()
	@MinLength(10)
	@MaxLength(2000)
	message!: string;

	@IsOptional()
	@IsString()
	@MaxLength(40)
	pseudo?: string;

	@IsOptional()
	@IsString()
	@MaxLength(10)
	roomCode?: string;

	@IsOptional()
	@IsString()
	@MaxLength(40)
	gameId?: string;

	@IsOptional()
	@IsString()
	@MaxLength(64)
	anonId?: string;

	@IsOptional()
	@IsString()
	@MaxLength(200)
	page?: string;
}
