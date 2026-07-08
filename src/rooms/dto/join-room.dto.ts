import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

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
}
