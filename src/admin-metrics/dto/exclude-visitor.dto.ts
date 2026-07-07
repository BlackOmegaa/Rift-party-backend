import { IsString, Length } from "class-validator";

export class ExcludeVisitorDto {
	@IsString()
	@Length(8, 64)
	anonId!: string;
}
