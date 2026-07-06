import { UndercoverPair } from "../interfaces/undercover.interface";

/**
 * Base de paires Undercover Champion. Chaque manche tire une paire au hasard :
 * tous les joueurs sauf un recoivent `normal`, un seul recoit `undercover`.
 * Pour enrichir le jeu : ajouter une ligne `{ normal: '...', undercover: '...' }`.
 * Aucune autre modification necessaire, la liste est consommee telle quelle.
 */
export const UNDERCOVER_PAIRS: UndercoverPair[] = [
	// Freres, soeurs et couples : lien de lore direct et bien connu
	{ normal: "Yasuo", undercover: "Yone" }, // demi-freres
	{ normal: "Kayle", undercover: "Morgana" }, // soeurs celestes, ange et demone
	{ normal: "Nasus", undercover: "Renekton" }, // freres, dieux dechus de Shurima
	{ normal: "Jinx", undercover: "Vi" }, // soeurs
	{ normal: "Xayah", undercover: "Rakan" }, // couple vastaya
	{ normal: "Senna", undercover: "Lucian" }, // maries
	{ normal: "Kassadin", undercover: "Kai'Sa" }, // pere et fille

	// Rivalites emblematiques, connues de tout joueur de LoL
	{ normal: "Darius", undercover: "Garen" }, // Noxus vs Demacia, LE duo du tuto
	{ normal: "Zed", undercover: "Shen" }, // freres d'armes du Kinkou devenus rivaux
	{ normal: "Kha'Zix", undercover: "Rengar" }, // le chasseur et sa proie
	{ normal: "Twisted Fate", undercover: "Graves" }, // ex-partenaires, trahison celebre
	{ normal: "Gangplank", undercover: "Miss Fortune" }, // vengeance a Bilgewater
	{ normal: "Viktor", undercover: "Jayce" }, // ex-amis, Evolution Glorieuse vs statu quo
	{ normal: "Diana", undercover: "Leona" }, // destins lies, soleil et lune
	{ normal: "Vladimir", undercover: "Swain" }, // rivaux pour le controle de Noxus
	{ normal: "Ziggs", undercover: "Heimerdinger" }, // rivaux inventeurs de Piltover/Zaun
	{ normal: "Urgot", undercover: "Renata Glasc" }, // vengeance contre les barons chimiques
	{ normal: "Ashe", undercover: "Sejuani" }, // rivales pour unifier le Freljord
	{ normal: "Caitlyn", undercover: "Jinx" }, // sherif et hors-la-loi (Arcane)

	// Meme faction, meme histoire
	{ normal: "Katarina", undercover: "Talon" }, // assassins de Noxus
	{ normal: "Ekko", undercover: "Vi" }, // amis d'enfance des bas-fonds de Zaun
	{ normal: "Anivia", undercover: "Volibear" }, // anciens esprits elementaires du Freljord
	{ normal: "Illaoi", undercover: "Pyke" }, // foi et vengeance a Bilgewater
	{ normal: "Aatrox", undercover: "Varus" }, // armes vivantes Darkin
	{ normal: "Singed", undercover: "Renata Glasc" }, // barons chimiques de Zaun
	{ normal: "Cho'Gath", undercover: "Bel'Veth" }, // monstres du Neant

	// Kits ou themes jumeaux, meme sans lien de lore direct
	{ normal: "Riven", undercover: "Irelia" }, // guerrieres ioniennes a la lame
	{ normal: "Camille", undercover: "Fiora" }, // duellistes chirurgicales, precision extreme
	{ normal: "Nautilus", undercover: "Blitzcrank" }, // tanks a crochet
	{ normal: "Braum", undercover: "Taric" }, // gardiens au bouclier et a la gemme
	{ normal: "Poppy", undercover: "Rammus" }, // petits tanks increvables
	{ normal: "Sion", undercover: "Dr. Mundo" }, // increvables, reviennent toujours
	{ normal: "Malphite", undercover: "Skarner" }, // colosses elementaires ancestraux
	{ normal: "Rumble", undercover: "Tristana" }, // yordles bricoleurs et explosifs
	{ normal: "Fiddlesticks", undercover: "Shaco" }, // concus pour semer la terreur
	{ normal: "Karthus", undercover: "Yorick" }, // cultes de la mort et des morts-vivants
	{ normal: "Ahri", undercover: "Ezreal" }, // duo recurrent des univers alternatifs (Star Guardian, Odyssey...)

	// Buffs, objectifs et monstres neutres
	{ normal: "Blue Buff", undercover: "Red Buff" },
	{ normal: "Baron Nashor", undercover: "Atakhan" },
	{ normal: "Dragon", undercover: "Rift Herald" },
	{ normal: "Scuttle Crab", undercover: "Krug" },
	{ normal: "Gromp", undercover: "Wolves" },
	{ normal: "Voidgrub", undercover: "Rift Herald" },

	// Roles et jargon
	{ normal: "Support", undercover: "ADC" },
	{ normal: "Toplane", undercover: "Jungle" },
	{ normal: "Midlane", undercover: "Toplane" },
	{ normal: "Tank", undercover: "Bruiser" },
	{ normal: "Assassin", undercover: "Mage" },
	{ normal: "Ward", undercover: "Control Ward" },
	{ normal: "Gank", undercover: "Invade" },
	{ normal: "Reset", undercover: "Recall" },
	{ normal: "Flash", undercover: "Ghost" },
	{ normal: "Teleport", undercover: "Flash" },
	{ normal: "Smite", undercover: "Ignite" },
	{ normal: "Backdoor", undercover: "Split push" },
	{ normal: "Ace", undercover: "Pentakill" },
	{ normal: "Feed", undercover: "Int" },
	{ normal: "Snowball", undercover: "Comeback" },
	{ normal: "Poke", undercover: "Engage" },
	{ normal: "Roam", undercover: "Rotation" },
	{ normal: "Farm", undercover: "CS" },

	// Lieux et lore de Runeterra
	{ normal: "Demacia", undercover: "Noxus" },
	{ normal: "Freljord", undercover: "Ionia" },
	{ normal: "Piltover", undercover: "Zaun" },
	{ normal: "Shurima", undercover: "Targon" },
	{ normal: "Bilgewater", undercover: "Shadow Isles" },
	{ normal: "Ionia", undercover: "Shadow Isles" },
	{ normal: "Summoner's Rift", undercover: "Howling Abyss" },
	{ normal: "Baron pit", undercover: "Dragon pit" },
	{ normal: "Nexus", undercover: "Inhibitor" },
	{ normal: "Fountain", undercover: "Base" },

	// Skins et cosmetiques
	{ normal: "Pool Party", undercover: "Star Guardian" },
	{ normal: "Arcane", undercover: "PROJECT" },
	{ normal: "KDA", undercover: "True Damage" },
	{ normal: "Odyssey", undercover: "Battle Academia" },
	{ normal: "Spirit Blossom", undercover: "Lunar Beast" },
	{ normal: "High Noon", undercover: "Dark Star" },
	{ normal: "Cosmic", undercover: "Astronaut" },

	// Emotes et memes du jeu
	{ normal: "/ff 15", undercover: "/mute all" },
	{ normal: "Nashor buff", undercover: "Elder Dragon" },
];
