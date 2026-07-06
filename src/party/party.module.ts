import { Module, OnModuleInit } from "@nestjs/common";
import { GamesModule } from "../games/games.module";
import { GamesRegistryService } from "../games/games.registry";

const PARTY_GAMES = [
	{
		id: "party-mix",
		label: "Party Mix",
		description:
			"Le mode principal : 15 manches melangees, recap Rift Report et stats de lobby.",
		minPlayers: 1,
		maxPlayers: 12,
	},
	{
		id: "guess-champion",
		label: "Guess The Champ",
		description:
			"Indices, silhouettes, sorts : devinez le champion le plus vite possible et hissez vous au sommet.",
		minPlayers: 1,
		maxPlayers: 12,
	},
	{
		id: "fusion-champions",
		label: "Fusion Champions",
		description:
			"Deux champions fusionnes en une seule carte. Devinez les deux noms le plus vite possible.",
		minPlayers: 1,
		maxPlayers: 12,
	},
	{
		id: "turret-tank",
		label: "Turret Tank",
		description:
			"Champion + items + niveau : estime combien de coup de tour il peut encaisser.",
		minPlayers: 1,
		maxPlayers: 12,
	},
	{
		id: "tiktok-ranking",
		label: "Tier list",
		description:
			"Classez les champions selon des criteres absurdes et comparez vos resultats avec les autres joueurs.",
		minPlayers: 3,
		maxPlayers: 12,
	},
	{
		id: "undercover-champion",
		label: "Undercover",
		description:
			"Un champion secret se cache parmi les autres. Interrogez les joueurs et demasquez l'imposteur a temps.",
		minPlayers: 3,
		maxPlayers: 12,
	},
	{
		id: "intrus",
		label: "Intrus",
		description:
			"5 champions ou skins affiches, un seul ne colle pas avec les autres. Trouvez l'intrus le plus vite possible.",
		minPlayers: 1,
		maxPlayers: 12,
	},
] as const;

@Module({ imports: [GamesModule] })
export class PartyModule implements OnModuleInit {
	constructor(private readonly registry: GamesRegistryService) {}

	onModuleInit() {
		PARTY_GAMES.forEach((game) => this.registry.register(game));
	}
}
