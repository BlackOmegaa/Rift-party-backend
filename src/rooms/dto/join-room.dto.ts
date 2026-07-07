import { IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class JoinRoomDto {
  @IsString()
  @Length(4, 8)
  code!: string;

  @IsString()
  @Length(1, 24)
  pseudo!: string;

  /** Vrai si le code venait d'un lien ?join=CODE plutot que tape a la main (voir home.component.ts). */
  @IsOptional()
  @IsBoolean()
  viaInvite?: boolean;

  /** JWT du compte joueur (PlayerAuthService), optionnel : determine isSubscriber sur le Player. Ne bloque jamais l'arrivee si absent/invalide. */
  @IsOptional()
  @IsString()
  @MaxLength(400)
  playerToken?: string;
}
