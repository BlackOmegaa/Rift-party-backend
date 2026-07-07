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
	{ normal: "Lissandra", undercover: "Ashe" }, // mere adoptive et fille du Freljord
	{ normal: "Taliyah", undercover: "Yasuo" }, // duo maitre-eleve devenu fraternel
	{ normal: "Sett", undercover: "Vi" }, // durs a cuire des bas-fonds, meme mere adoptive (Vander)
	{ normal: "Aphelios", undercover: "Alune" }, // frere et soeur, il se bat elle voit pour lui

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
	{ normal: "Jarvan IV", undercover: "Lissandra" }, // Demacia contre la Reine de glace
	{ normal: "Fiora", undercover: "Garen" }, // duel Grand Duelliste vs colosse de Demacia
	{ normal: "Malzahar", undercover: "Kayn" }, // deux voies pour servir le Neant, l'une pactisee l'autre conquerante
	{ normal: "Quinn", undercover: "Vayne" }, // chasseuses de monstres demaciennes, styles opposes

	// Meme faction, meme histoire
	{ normal: "Katarina", undercover: "Talon" }, // assassins de Noxus
	{ normal: "Ekko", undercover: "Vi" }, // amis d'enfance des bas-fonds de Zaun
	{ normal: "Anivia", undercover: "Volibear" }, // anciens esprits elementaires du Freljord
	{ normal: "Illaoi", undercover: "Pyke" }, // foi et vengeance a Bilgewater
	{ normal: "Aatrox", undercover: "Varus" }, // armes vivantes Darkin
	{ normal: "Singed", undercover: "Renata Glasc" }, // barons chimiques de Zaun
	{ normal: "Cho'Gath", undercover: "Bel'Veth" }, // monstres du Neant
	{ normal: "Zyra", undercover: "Neeko" }, // filles de la nature du Neant a la jungle vivante
	{ normal: "Vex", undercover: "Zoe" }, // yordles lies au Neant, l'une deprimee l'autre chaotique
	{ normal: "Rhaast", undercover: "Kayn" }, // l'arme Darkin et son porteur, meme corps a terme
	{ normal: "Warwick", undercover: "Zac" }, // creations chimiques de Zaun, monstres malgre eux

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
	{ normal: "Lux", undercover: "Ezreal" }, // mages a projectile skillshot, meme profil de kit
	{ normal: "Annie", undercover: "Zoe" }, // apparence enfantine, puissance devastatrice
	{ normal: "Master Yi", undercover: "Yasuo" }, // epeistes mobiles obsedes par la vitesse d'attaque ou le crit
	{ normal: "Shyvana", undercover: "Nidalee" }, // hybrides mi-humaines mi-betes qui se transforment
	{ normal: "Twitch", undercover: "Teemo" }, // petites creatures furtives detestees en solo queue

	// Buffs, objectifs et monstres neutres
	{ normal: "Blue Buff", undercover: "Red Buff" },
	{ normal: "Baron Nashor", undercover: "Atakhan" },
	{ normal: "Dragon", undercover: "Rift Herald" },
	{ normal: "Scuttle Crab", undercover: "Krug" },
	{ normal: "Gromp", undercover: "Wolves" },
	{ normal: "Voidgrub", undercover: "Rift Herald" },

	// Monstres et jungle
	{ normal: "Blue Sentinel", undercover: "Red Brambleback" },
	{ normal: "Ocean Dragon", undercover: "Cloud Dragon" },
	{ normal: "Mountain Dragon", undercover: "Infernal Dragon" },
	{ normal: "Crimson Raptor", undercover: "Atakhan" },

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
	{ normal: "Freeze", undercover: "Slow push" },
	{ normal: "Peel", undercover: "Zone" },
	{ normal: "Wombo combo", undercover: "Teamfight" },
	{ normal: "Carry", undercover: "Hard carry" },
	{ normal: "One trick", undercover: "OTP" },

	// Termes competitifs esport
	{ normal: "Worlds", undercover: "MSI" },
	{ normal: "LEC", undercover: "LCK" },
	{ normal: "Draft", undercover: "Ban phase" },
	{ normal: "Best of 5", undercover: "Best of 1" },
	{ normal: "Scrim", undercover: "Solo queue" },
	{ normal: "Coach", undercover: "Analyste" },
	{ normal: "Sub", undercover: "Starter" },
	{ normal: "Meta", undercover: "Patch" },

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
	{ normal: "Mont Targon", undercover: "Freljord" },
	{ normal: "Zaun", undercover: "Shadow Isles" },
	{ normal: "Grand Palais de Demacia", undercover: "Placidium de Navori" }, // sieges du pouvoir a Demacia et en Ionia
	{ normal: "Icathia", undercover: "Shurima" }, // cite maudite ensevelie sous le desert shurimaen

	// Items
	{ normal: "Infinity Edge", undercover: "Rabadon's Deathcap" }, // objets finaux iconiques, crit vs AP
	{ normal: "Doran's Blade", undercover: "Doran's Ring" }, // items de depart les plus achetes
	{ normal: "Boots of Swiftness", undercover: "Mercury's Treads" }, // bottes situationnelles
	{ normal: "Zhonya's Hourglass", undercover: "Guardian Angel" }, // items qui sauvent la vie in extremis
	{ normal: "Trinity Force", undercover: "Divine Sunderer" }, // mythiques bruiser bien connus
	{ normal: "Thornmail", undercover: "Sunfire Aegis" }, // items anti-carry physique
	{ normal: "Bloodthirster", undercover: "Death's Dance" }, // items de survie pour carry AD

	// Skins et cosmetiques
	{ normal: "Pool Party", undercover: "Star Guardian" },
	{ normal: "Arcane", undercover: "PROJECT" },
	{ normal: "KDA", undercover: "True Damage" },
	{ normal: "Odyssey", undercover: "Battle Academia" },
	{ normal: "Spirit Blossom", undercover: "Lunar Beast" },
	{ normal: "High Noon", undercover: "Dark Star" },
	{ normal: "Cosmic", undercover: "Astronaut" },
	{ normal: "Blood Moon", undercover: "Lunar Beast" },
	{ normal: "Coven", undercover: "Dark Star" },
	{ normal: "Debonair", undercover: "Prestige" }, // lignes de skins elegantes classe premium
	{ normal: "Winterblessed", undercover: "Snow Moon" },
	{ normal: "Firecracker", undercover: "Lunar New Year" }, // skins du nouvel an lunaire

	// Evenements et skins recents
	{ normal: "Soul Fighter", undercover: "Street Demons" },
	{ normal: "HEARTSTEEL", undercover: "K/DA ALL OUT" }, // groupes de musique virtuels Riot
	{ normal: "Arcane Fractured", undercover: "Arcane" }, // skins lies a la serie animee
	{ normal: "Empyrean", undercover: "Immortalized Legend" },
	{ normal: "Pass de combat", undercover: "Coffre hextech" }, // sources de skins gratuits ou payants

	// Emotes et memes du jeu
	{ normal: "/ff 15", undercover: "/mute all" },
	{ normal: "Nashor buff", undercover: "Elder Dragon" },
	{ normal: "Report", undercover: "Mute" },
	{ normal: "GG EZ", undercover: "GG WP" },
	{ normal: "Inting", undercover: "Trolling" },
	{ normal: "Loading screen", undercover: "Victory screen" },
];
