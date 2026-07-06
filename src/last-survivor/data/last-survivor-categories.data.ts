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
];
