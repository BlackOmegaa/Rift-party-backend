/**
 * Categories Last Survivor : un titre + un pool de candidats a eliminer un par un.
 * `champion` sert a l'illustration cote front (square art Data Dragon), `label`
 * est le nom affiche (permet des candidats "skin" illustres par leur champion,
 * meme convention que le mini-jeu Intrus).
 */
export interface LastSurvivorCandidate {
	champion: string;
	label: string;
}

export interface LastSurvivorCategory {
	title: string;
	candidates: LastSurvivorCandidate[];
}

const c = (name: string): LastSurvivorCandidate => ({ champion: name, label: name });
const skin = (champion: string, label: string): LastSurvivorCandidate => ({ champion, label });

export const LAST_SURVIVOR_CATEGORIES: LastSurvivorCategory[] = [
	{
		title: "Meilleur ADC",
		candidates: [c("Jinx"), c("Kai'Sa"), c("Caitlyn"), c("Vayne"), c("Ezreal"), c("Ashe"), c("Jhin"), c("Draven")],
	},
	{
		title: "Meilleur Support",
		candidates: [c("Thresh"), c("Lulu"), c("Leona"), c("Nami"), c("Braum"), c("Pyke"), c("Yuumi"), c("Blitzcrank")],
	},
	{
		title: "Champion le plus insupportable",
		candidates: [c("Teemo"), c("Yuumi"), c("Shaco"), c("Singed"), c("Zed"), c("Yasuo"), c("Master Yi"), c("Heimerdinger")],
	},
	{
		title: "Champion le plus iconique",
		candidates: [c("Yasuo"), c("Lee Sin"), c("Thresh"), c("Jinx"), c("Ahri"), c("Garen"), c("Teemo"), c("Lux")],
	},
	{
		title: "Meilleur Mid Laner",
		candidates: [c("Ahri"), c("Zed"), c("Yasuo"), c("Syndra"), c("Orianna"), c("Katarina"), c("Akali"), c("Viktor")],
	},
	{
		title: "Meilleur Jungler",
		candidates: [c("Lee Sin"), c("Kha'Zix"), c("Vi"), c("Hecarim"), c("Kindred"), c("Warwick"), c("Elise"), c("Kayn")],
	},
	{
		title: "Meilleur Top Laner",
		candidates: [c("Darius"), c("Garen"), c("Fiora"), c("Camille"), c("Jax"), c("Riven"), c("Sett"), c("Aatrox")],
	},
	{
		title: "Meilleur skin PROJECT",
		candidates: [
			skin("Yasuo", "PROJECT: Yasuo"),
			skin("Zed", "PROJECT: Zed"),
			skin("Ashe", "PROJECT: Ashe"),
			skin("Vayne", "PROJECT: Vayne"),
			skin("Fiora", "PROJECT: Fiora"),
			skin("Ekko", "PROJECT: Ekko"),
			skin("Jhin", "PROJECT: Jhin"),
			skin("Vi", "PROJECT: Vi"),
		],
	},
	{
		title: "Mascotte officielle de Runeterra",
		candidates: [c("Teemo"), c("Poppy"), c("Amumu"), c("Kennen"), c("Ziggs"), c("Lulu"), c("Tristana"), c("Heimerdinger")],
	},
	{
		title: "Champion avec qui partir en vacances",
		candidates: [c("Braum"), c("Gragas"), c("Miss Fortune"), c("Sett"), c("Sona"), c("Graves"), c("Ahri"), c("Bard")],
	},
	{
		title: "Champion le plus cracked en solo queue",
		candidates: [c("Yasuo"), c("Katarina"), c("Riven"), c("Lee Sin"), c("Zed"), c("Akali"), c("Qiyana"), c("Yone")],
	},
	{
		title: "Meilleur skin K/DA",
		candidates: [
			skin("Ahri", "K/DA Ahri"),
			skin("Akali", "K/DA Akali"),
			skin("Evelynn", "K/DA Evelynn"),
			skin("Kai'Sa", "K/DA Kai'Sa"),
			skin("Seraphine", "K/DA Seraphine"),
			skin("Kayle", "K/DA Kayle"),
			skin("Miss Fortune", "K/DA Miss Fortune"),
			skin("Gwen", "K/DA ALL OUT Gwen"),
		],
	},
	{
		title: "Meilleur skin Star Guardian",
		candidates: [
			skin("Lux", "Star Guardian Lux"),
			skin("Ahri", "Star Guardian Ahri"),
			skin("Ezreal", "Star Guardian Ezreal"),
			skin("Jinx", "Star Guardian Jinx"),
			skin("Syndra", "Star Guardian Syndra"),
			skin("Neeko", "Star Guardian Neeko"),
			skin("Miss Fortune", "Star Guardian Miss Fortune"),
			skin("Rakan", "Star Guardian Rakan"),
		],
	},
	{
		title: "Meilleur skin Arcane",
		candidates: [
			skin("Jinx", "Arcane Jinx"),
			skin("Vi", "Arcane Vi"),
			skin("Caitlyn", "Arcane Caitlyn"),
			skin("Jayce", "Arcane Jayce"),
			skin("Viktor", "Arcane Viktor"),
			skin("Ekko", "Arcane Ekko"),
			skin("Warwick", "Arcane Warwick"),
			skin("Ambessa", "Arcane Ambessa"),
		],
	},
	{
		title: "Meilleur skin High Noon",
		candidates: [
			skin("Yasuo", "High Noon Yasuo"),
			skin("Lucian", "High Noon Lucian"),
			skin("Thresh", "High Noon Thresh"),
			skin("Ashe", "High Noon Ashe"),
			skin("Senna", "High Noon Senna"),
			skin("Twisted Fate", "High Noon Twisted Fate"),
			skin("Miss Fortune", "High Noon Miss Fortune"),
			skin("Sylas", "High Noon Sylas"),
		],
	},
	{
		title: "Meilleur skin Spirit Blossom",
		candidates: [
			skin("Yasuo", "Spirit Blossom Yasuo"),
			skin("Thresh", "Spirit Blossom Thresh"),
			skin("Ahri", "Spirit Blossom Ahri"),
			skin("Kindred", "Spirit Blossom Kindred"),
			skin("Vayne", "Spirit Blossom Vayne"),
			skin("Teemo", "Spirit Blossom Teemo"),
			skin("Aatrox", "Spirit Blossom Aatrox"),
			skin("Cassiopeia", "Spirit Blossom Cassiopeia"),
		],
	},
	{
		title: "Meilleur skin Odyssey",
		candidates: [
			skin("Kayn", "Odyssey Kayn"),
			skin("Kai'Sa", "Odyssey Kai'Sa"),
			skin("Jhin", "Odyssey Jhin"),
			skin("Malphite", "Odyssey Malphite"),
			skin("Sona", "Odyssey Sona"),
			skin("Yasuo", "Odyssey Yasuo"),
			skin("Ezreal", "Odyssey Ezreal"),
			skin("Fizz", "Odyssey Fizz"),
		],
	},
	{
		title: "Meilleur skin Cosmic",
		candidates: [
			skin("Jhin", "Cosmic Enchantress Jhin"),
			skin("Kindred", "Cosmic Hunter Kindred"),
			skin("Karma", "Cosmic Enchantress Karma"),
			skin("Azir", "Cosmic Reaver Azir"),
			skin("Malphite", "Cosmic Malphite"),
			skin("Gnar", "Cosmic Gnar"),
			skin("Janna", "Cosmic Janna"),
			skin("Xerath", "Cosmic Devourer Xerath"),
		],
	},
	{
		title: "Le plus increvable en teamfight",
		candidates: [c("Sion"), c("Mundo"), c("Cho'Gath"), c("Sett"), c("Tahm Kench"), c("Maokai"), c("Ornn"), c("K'Sante")],
	},
	{
		title: "Le meilleur pour carry en 1v9",
		candidates: [c("Yasuo"), c("Katarina"), c("Master Yi"), c("Riven"), c("Fiora"), c("Kayn"), c("Yone"), c("Qiyana")],
	},
	{
		title: "Champion le plus snowball",
		candidates: [c("Kayle"), c("Master Yi"), c("Tryndamere"), c("Nasus"), c("Veigar"), c("Kassadin"), c("Vayne"), c("Jax")],
	},
	{
		title: "Le plus tilt-inducing a jouer contre",
		candidates: [c("Yuumi"), c("Teemo"), c("Kled"), c("Fizz"), c("Zoe"), c("Yasuo"), c("Vex"), c("Nasus")],
	},
	{
		title: "Champion le plus mobile de la Faille",
		candidates: [c("Akali"), c("Kalista"), c("Ezreal"), c("Zeri"), c("Yasuo"), c("Qiyana"), c("Rakan"), c("Kassadin")],
	},
	{
		title: "Le meilleur pick en clutch a bas HP",
		candidates: [c("Zilean"), c("Anivia"), c("Yasuo"), c("Fizz"), c("Tryndamere"), c("Aatrox"), c("Kayle"), c("Vladimir")],
	},
	{
		title: "Champion le plus meme de la communaute",
		candidates: [c("Teemo"), c("Yuumi"), c("Singed"), c("Shaco"), c("Amumu"), c("Urgot"), c("Zilean"), c("Dr. Mundo")],
	},
	{
		title: "Le plus cringe a voir en montage YouTube",
		candidates: [c("Yasuo"), c("Master Yi"), c("Katarina"), c("Riven"), c("Zed"), c("Yone"), c("Akali"), c("Lee Sin")],
	},
	{
		title: "Meilleur dragon de Runeterra",
		candidates: [c("Shyvana"), c("Aurelion Sol"), c("Smolder"), c("Renekton"), c("Rengar"), c("Cho'Gath"), c("Trundle"), c("Aatrox")],
	},
	{
		title: "Meilleur yordle",
		candidates: [c("Teemo"), c("Tristana"), c("Poppy"), c("Lulu"), c("Rumble"), c("Veigar"), c("Kennen"), c("Corki")],
	},
	{
		title: "Le plus grand genie de la tech de Piltover et Zaun",
		candidates: [c("Heimerdinger"), c("Jayce"), c("Viktor"), c("Ziggs"), c("Ekko"), c("Orianna"), c("Camille"), c("Vex")],
	},
	{
		title: "Meilleur esprit ou entite spirituelle",
		candidates: [c("Kindred"), c("Yone"), c("Yasuo"), c("Nunu & Willump"), c("Bard"), c("Ivern"), c("Anivia"), c("Ahri")],
	},
	{
		title: "Meilleur mort-vivant ou revenant",
		candidates: [c("Thresh"), c("Karthus"), c("Yorick"), c("Sion"), c("Hecarim"), c("Senna"), c("Viego"), c("Mordekaiser")],
	},
	{
		title: "Champion le plus stylise en ville",
		candidates: [c("Ekko"), c("Akali"), c("Jhin"), c("Samira"), c("Yasuo"), c("Sett"), c("Qiyana"), c("Kai'Sa")],
	},
	{
		title: "Meilleur duo bot lane historique",
		candidates: [c("Jinx"), c("Vi"), c("Lucian"), c("Senna"), c("Rakan"), c("Xayah"), c("Renata Glasc"), c("Kalista")],
	},
	{
		title: "Champion avec le meilleur design visuel",
		candidates: [c("Jhin"), c("Kai'Sa"), c("Thresh"), c("Aphelios"), c("Camille"), c("Aurelion Sol"), c("Viego"), c("Seraphine")],
	},
	{
		title: "Meilleur one-trick pony du serveur",
		candidates: [c("Yasuo"), c("Yuumi"), c("Nasus"), c("Shaco"), c("Teemo"), c("Kalista"), c("Azir"), c("Riven")],
	},
	{
		title: "Le plus dur a apprendre",
		candidates: [c("Azir"), c("Aphelios"), c("Riven"), c("Nidalee"), c("Yasuo"), c("Bard"), c("Qiyana"), c("Gangplank")],
	},
	{
		title: "Champion le plus op en debut de saison",
		candidates: [c("Zeri"), c("Kai'Sa"), c("Akshan"), c("Bel'Veth"), c("Nilah"), c("Briar"), c("Smolder"), c("Naafiri")],
	},
	{
		title: "Meilleur assassin de la meta actuelle",
		candidates: [c("Zed"), c("Akali"), c("Talon"), c("Kha'Zix"), c("Qiyana"), c("Naafiri"), c("Kassadin"), c("Rengar")],
	},
	{
		title: "Meilleur tank de la meta actuelle",
		candidates: [c("Ornn"), c("Malphite"), c("Sejuani"), c("K'Sante"), c("Maokai"), c("Rammus"), c("Zac"), c("Amumu")],
	},
	{
		title: "Le plus efficace pour push la wave",
		candidates: [c("Ziggs"), c("Nasus"), c("Ryze"), c("Ashe"), c("Ivern"), c("Ezreal"), c("Ahri"), c("Kog'Maw")],
	},
	{
		title: "Champion avec la meilleure ultime du jeu",
		candidates: [c("Miss Fortune"), c("Ashe"), c("Galio"), c("Pyke"), c("Sona"), c("Karthus"), c("Malphite"), c("Jinx")],
	},
	{
		title: "Le plus efficace pour engage un teamfight",
		candidates: [c("Malphite"), c("Leona"), c("Rakan"), c("Amumu"), c("Vi"), c("Sejuani"), c("Nautilus"), c("Zac")],
	},
	{
		title: "Meilleur champion pour debutant",
		candidates: [c("Garen"), c("Annie"), c("Master Yi"), c("Ashe"), c("Malphite"), c("Warwick"), c("Miss Fortune"), c("Soraka")],
	},
	{
		title: "Champion le plus royal ou noble",
		candidates: [c("Jarvan IV"), c("Ashe"), c("Sivir"), c("Swain"), c("LeBlanc"), c("Kalista"), c("Viego"), c("Renata Glasc")],
	},
	{
		title: "Meilleur monstre ou creature de la faille",
		candidates: [c("Cho'Gath"), c("Kog'Maw"), c("Rengar"), c("Kha'Zix"), c("Warwick"), c("Nunu & Willump"), c("Vel'Koz"), c("Zac")],
	},
	{
		title: "Meilleur skin legendaire toutes lignes confondues",
		candidates: [
			skin("Yasuo", "Blood Moon Yasuo"),
			skin("Jhin", "Blood Moon Jhin"),
			skin("Thresh", "Championship Thresh"),
			skin("Kayn", "Odyssey Kayn"),
			skin("Riven", "Redeemed Riven"),
			skin("Gwen", "Sentinel Gwen"),
			skin("Volibear", "God-King Volibear"),
			skin("Aatrox", "God-King Aatrox"),
		],
	},
	{
		title: "Le plus dangereux en pick unique de milieu de jeu",
		candidates: [c("Twisted Fate"), c("Katarina"), c("Kassadin"), c("Fizz"), c("Talon"), c("Zed"), c("LeBlanc"), c("Akali")],
	},
	{
		title: "Meilleur champion pour flex plusieurs roles",
		candidates: [c("Pyke"), c("Swain"), c("Sett"), c("Seraphine"), c("Karma"), c("Yasuo"), c("Neeko"), c("Vex")],
	},
	{
		title: "Le plus satisfaisant a jouer en split push",
		candidates: [c("Fiora"), c("Tryndamere"), c("Jax"), c("Camille"), c("Nasus"), c("Yorick"), c("Trundle"), c("Kled")],
	},
	{
		title: "Champion avec la meilleure voix ou personnalite",
		candidates: [c("Draven"), c("Jinx"), c("Gragas"), c("Ziggs"), c("Twitch"), c("Vex"), c("Sett"), c("Blitzcrank")],
	},
	{
		title: "Meilleur main jungle pour ganker tot",
		candidates: [c("Lee Sin"), c("Elise"), c("Nidalee"), c("Rengar"), c("Xin Zhao"), c("Kha'Zix"), c("Nocturne"), c("Rammus")],
	},
	{
		title: "Le plus fun a jouer en ARAM",
		candidates: [c("Ziggs"), c("Miss Fortune"), c("Lux"), c("Sona"), c("Nunu & Willump"), c("Karthus"), c("Anivia"), c("Zilean")],
	},
	{
		title: "Champion associe a la magie noire ou obscure",
		candidates: [c("Morgana"), c("Vladimir"), c("Karthus"), c("Mordekaiser"), c("Elise"), c("Evelynn"), c("Viego"), c("Swain")],
	},
];
