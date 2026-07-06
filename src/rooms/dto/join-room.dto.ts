import { IsString, Length } from 'class-validator';

export class JoinRoomDto {
  @IsString()
  @Length(4, 8)
  code!: string;

  @IsString()
  @Length(1, 24)
  pseudo!: string;
}
