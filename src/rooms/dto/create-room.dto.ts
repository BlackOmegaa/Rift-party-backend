import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @Length(1, 24)
  pseudo!: string;

  /** JWT du compte joueur (PlayerAuthService), optionnel : determine isSubscriber sur le Player. Ne bloque jamais la creation si absent/invalide. */
  @IsOptional()
  @IsString()
  @MaxLength(400)
  playerToken?: string;
}
