import { Champion, ChampionRarity, Role } from '../interfaces/draft.interface';

export const RARITY_META: Record<ChampionRarity, { label: string; color: string; order: number }> = {
  gratuit: { label: 'Sbire', color: '#6b7684', order: -1 },
  commun: { label: 'Commun', color: '#cbd5e0', order: 0 },
  rare: { label: 'Rare', color: '#22e07d', order: 1 },
  'tres-rare': { label: 'Tres Rare', color: '#2f9dff', order: 2 },
  epique: { label: 'Epique', color: '#c65bff', order: 3 },
  legendaire: { label: 'Legendaire', color: '#ff9012', order: 4 },
  mythique: { label: 'Mythique', color: '#ef5da8', order: 5 },
};

const RARITY_PRICE_RANGES: Record<ChampionRarity, [number, number]> = {
  gratuit: [0, 0],
  commun: [8, 14],
  rare: [15, 22],
  'tres-rare': [23, 32],
  epique: [33, 45],
  legendaire: [46, 62],
  mythique: [78, 95],
};

/**
 * Sbires : filet de securite quand un joueur n'a plus de quoi acheter le
 * moindre champion "commun" pour un role. Cout 0, stats/tags volontairement
 * faibles (jamais de tag fort type assassin/mage/marksman) pour que le pick
 * reste un pur depannage, jamais un choix competitif. Voir refreshOffers()
 * cote front (draft-battle.component.ts) : n'apparaissent QUE si le role est
 * injouable, jamais en temps normal.
 */
const SBIRE_CHAMPIONS: Champion[] = [
  { id: 'sbire-top', name: 'Sbire (Melee)', cost: 0, roles: ['TOP'], tags: ['ad'], ccScore: 0, rarity: 'gratuit' },
  { id: 'sbire-jungle', name: 'Sbire (Loup)', cost: 0, roles: ['JUNGLE'], tags: ['ad'], ccScore: 0, rarity: 'gratuit' },
  { id: 'sbire-mid', name: 'Sbire (Caster)', cost: 0, roles: ['MID'], tags: ['ap'], ccScore: 0, rarity: 'gratuit' },
  { id: 'sbire-adc', name: 'Sbire (Canon)', cost: 0, roles: ['ADC'], tags: ['ad'], ccScore: 0, rarity: 'gratuit' },
  { id: 'sbire-support', name: 'Sbire (Poro)', cost: 0, roles: ['SUPPORT'], tags: ['support'], ccScore: 0, rarity: 'gratuit' },
];

/**
 * Pool de champions pour Draft Battle.
 * IMPORTANT (voir ARCHITECTURE.md section 0) : ces donnees reprennent l'univers
 * League of Legends a titre d'exemple / usage entre amis. C'est volontairement
 * la SEULE couche du code qui connait des noms de champions : le moteur de
 * scoring (draft-scoring.engine.ts) ne raisonne que sur `tags`/`roles`/`ccScore`.
 * Remplacer cette liste par un univers original ne demande de toucher aucun
 * autre fichier.
 *
 * `cost` ci-dessous sert de proxy de puissance brute : il est utilise par
 * `assignRarityAndPrice` pour repartir les champions en paliers de rarete puis
 * reecrit avec le vrai prix (escalade par palier, voir RARITY_PRICE_RANGES).
 * Ne jamais lire ce `cost` brut directement ailleurs : toujours passer par
 * `CHAMPIONS` (export final, en bas de fichier).
 */
const CHAMPIONS_RAW: Omit<Champion, 'rarity'>[] = [
  { id: 'aatrox', name: 'Aatrox', cost: 19, roles: ['TOP'], tags: ['fighter', 'sustain', 'ad', 'engage', 'scaling-mid'], ccScore: 1 },
  { id: 'ahri', name: 'Ahri', cost: 18, roles: ['MID'], tags: ['mage', 'burst', 'mobility', 'ap', 'scaling-mid', 'poke'], ccScore: 1 },
  { id: 'akali', name: 'Akali', cost: 22, roles: ['MID', 'TOP'], tags: ['assassin', 'ap', 'burst', 'mobility', 'scaling-mid'], ccScore: 0 },
  { id: 'amumu', name: 'Amumu', cost: 14, roles: ['JUNGLE'], tags: ['tank', 'engage', 'cc-heavy', 'ap', 'scaling-early'], ccScore: 3 },
  { id: 'ashe', name: 'Ashe', cost: 17, roles: ['ADC'], tags: ['marksman', 'ad', 'engage', 'poke', 'cc-heavy', 'scaling-mid'], ccScore: 2 },
  { id: 'azir', name: 'Azir', cost: 23, roles: ['MID'], tags: ['mage', 'ap', 'scaling-late', 'poke'], ccScore: 1 },
  { id: 'blitzcrank', name: 'Blitzcrank', cost: 18, roles: ['SUPPORT'], tags: ['tank', 'support', 'engage', 'cc-heavy'], ccScore: 3 },
  { id: 'braum', name: 'Braum', cost: 16, roles: ['SUPPORT'], tags: ['tank', 'support', 'engage', 'disengage', 'cc-heavy'], ccScore: 3 },
  { id: 'caitlyn', name: 'Caitlyn', cost: 19, roles: ['ADC'], tags: ['marksman', 'ad', 'poke', 'scaling-mid'], ccScore: 1 },
  { id: 'camille', name: 'Camille', cost: 21, roles: ['TOP'], tags: ['fighter', 'ad', 'mobility', 'engage', 'scaling-late'], ccScore: 1 },
  { id: 'darius', name: 'Darius', cost: 16, roles: ['TOP'], tags: ['fighter', 'ad', 'sustain', 'scaling-early'], ccScore: 1 },
  { id: 'diana', name: 'Diana', cost: 20, roles: ['JUNGLE', 'MID'], tags: ['fighter', 'ap', 'engage', 'burst', 'scaling-mid'], ccScore: 1 },
  { id: 'draven', name: 'Draven', cost: 23, roles: ['ADC'], tags: ['marksman', 'ad', 'scaling-early', 'burst'], ccScore: 0 },
  { id: 'ekko', name: 'Ekko', cost: 20, roles: ['MID', 'JUNGLE'], tags: ['assassin', 'ap', 'burst', 'mobility', 'scaling-mid'], ccScore: 1 },
  { id: 'elise', name: 'Elise', cost: 17, roles: ['JUNGLE'], tags: ['mage', 'ap', 'burst', 'scaling-early'], ccScore: 1 },
  { id: 'ezreal', name: 'Ezreal', cost: 20, roles: ['ADC'], tags: ['marksman', 'ad', 'poke', 'mobility', 'scaling-mid'], ccScore: 0 },
  { id: 'fiddlesticks', name: 'Fiddlesticks', cost: 18, roles: ['JUNGLE'], tags: ['mage', 'ap', 'engage', 'cc-heavy', 'scaling-mid'], ccScore: 3 },
  { id: 'fiora', name: 'Fiora', cost: 22, roles: ['TOP'], tags: ['fighter', 'ad', 'mobility', 'sustain', 'scaling-late'], ccScore: 0 },
  { id: 'galio', name: 'Galio', cost: 18, roles: ['MID', 'SUPPORT'], tags: ['tank', 'mage', 'ap', 'engage', 'cc-heavy'], ccScore: 3 },
  { id: 'garen', name: 'Garen', cost: 14, roles: ['TOP'], tags: ['fighter', 'sustain', 'ad', 'scaling-early'], ccScore: 0 },
  { id: 'gragas', name: 'Gragas', cost: 17, roles: ['JUNGLE', 'TOP'], tags: ['tank', 'ap', 'engage', 'disengage', 'cc-heavy'], ccScore: 3 },
  { id: 'graves', name: 'Graves', cost: 19, roles: ['JUNGLE'], tags: ['fighter', 'ad', 'burst', 'scaling-mid'], ccScore: 0 },
  { id: 'hecarim', name: 'Hecarim', cost: 19, roles: ['JUNGLE'], tags: ['fighter', 'ad', 'engage', 'mobility', 'scaling-mid'], ccScore: 2 },
  { id: 'irelia', name: 'Irelia', cost: 22, roles: ['TOP', 'MID'], tags: ['fighter', 'ad', 'mobility', 'sustain', 'scaling-mid'], ccScore: 1 },
  { id: 'ivern', name: 'Ivern', cost: 15, roles: ['JUNGLE'], tags: ['support', 'ap', 'disengage', 'sustain'], ccScore: 1 },
  { id: 'janna', name: 'Janna', cost: 14, roles: ['SUPPORT'], tags: ['support', 'disengage', 'sustain', 'ap'], ccScore: 2 },
  { id: 'jarvan', name: 'Jarvan IV', cost: 18, roles: ['JUNGLE', 'TOP'], tags: ['fighter', 'ad', 'engage', 'cc-heavy', 'scaling-early'], ccScore: 2 },
  { id: 'jax', name: 'Jax', cost: 21, roles: ['TOP', 'JUNGLE'], tags: ['fighter', 'ad', 'mobility', 'scaling-late'], ccScore: 1 },
  { id: 'jhin', name: 'Jhin', cost: 21, roles: ['ADC'], tags: ['marksman', 'ad', 'poke', 'burst', 'scaling-mid'], ccScore: 1 },
  { id: 'jinx', name: 'Jinx', cost: 22, roles: ['ADC'], tags: ['marksman', 'ad', 'scaling-late'], ccScore: 1 },
  { id: 'kaisa', name: "Kai'Sa", cost: 22, roles: ['ADC'], tags: ['marksman', 'ad', 'ap', 'mobility', 'scaling-late'], ccScore: 0 },
  { id: 'kalista', name: 'Kalista', cost: 20, roles: ['ADC'], tags: ['marksman', 'ad', 'mobility', 'scaling-early'], ccScore: 1 },
  { id: 'katarina', name: 'Katarina', cost: 20, roles: ['MID'], tags: ['assassin', 'ap', 'burst', 'mobility'], ccScore: 0 },
  { id: 'kayle', name: 'Kayle', cost: 20, roles: ['TOP', 'ADC'], tags: ['fighter', 'ad', 'ap', 'scaling-late'], ccScore: 1 },
  { id: 'kayn', name: 'Kayn', cost: 20, roles: ['JUNGLE'], tags: ['fighter', 'assassin', 'ad', 'mobility', 'sustain'], ccScore: 1 },
  { id: 'khazix', name: "Kha'Zix", cost: 21, roles: ['JUNGLE'], tags: ['assassin', 'ad', 'burst', 'mobility', 'scaling-mid'], ccScore: 0 },
  { id: 'kindred', name: 'Kindred', cost: 20, roles: ['JUNGLE'], tags: ['marksman', 'ad', 'mobility', 'scaling-late'], ccScore: 0 },
  { id: 'leblanc', name: 'LeBlanc', cost: 22, roles: ['MID'], tags: ['assassin', 'ap', 'burst', 'mobility', 'poke'], ccScore: 1 },
  { id: 'lee-sin', name: 'Lee Sin', cost: 20, roles: ['JUNGLE'], tags: ['fighter', 'ad', 'mobility', 'engage', 'scaling-early'], ccScore: 1 },
  { id: 'leona', name: 'Leona', cost: 18, roles: ['SUPPORT'], tags: ['tank', 'support', 'engage', 'cc-heavy'], ccScore: 3 },
  { id: 'lissandra', name: 'Lissandra', cost: 19, roles: ['MID'], tags: ['mage', 'ap', 'engage', 'cc-heavy', 'burst'], ccScore: 3 },
  { id: 'lucian', name: 'Lucian', cost: 20, roles: ['ADC', 'MID'], tags: ['marksman', 'ad', 'mobility', 'scaling-early'], ccScore: 0 },
  { id: 'lulu', name: 'Lulu', cost: 17, roles: ['SUPPORT'], tags: ['support', 'ap', 'sustain', 'disengage'], ccScore: 2 },
  { id: 'lux', name: 'Lux', cost: 16, roles: ['MID', 'SUPPORT'], tags: ['mage', 'poke', 'cc-heavy', 'ap', 'scaling-mid'], ccScore: 2 },
  { id: 'malphite', name: 'Malphite', cost: 20, roles: ['TOP', 'JUNGLE'], tags: ['tank', 'engage', 'cc-heavy', 'ap', 'scaling-mid'], ccScore: 3 },
  { id: 'morgana', name: 'Morgana', cost: 16, roles: ['SUPPORT', 'MID'], tags: ['mage', 'cc-heavy', 'disengage', 'ap'], ccScore: 3 },
  { id: 'nautilus', name: 'Nautilus', cost: 18, roles: ['SUPPORT', 'JUNGLE'], tags: ['tank', 'engage', 'cc-heavy'], ccScore: 3 },
  { id: 'nami', name: 'Nami', cost: 16, roles: ['SUPPORT'], tags: ['support', 'sustain', 'engage', 'disengage', 'ap'], ccScore: 2 },
  { id: 'nocturne', name: 'Nocturne', cost: 18, roles: ['JUNGLE'], tags: ['assassin', 'fighter', 'ad', 'engage', 'scaling-mid'], ccScore: 1 },
  { id: 'orianna', name: 'Orianna', cost: 22, roles: ['MID'], tags: ['mage', 'ap', 'engage', 'cc-heavy', 'scaling-late'], ccScore: 2 },
  { id: 'ornn', name: 'Ornn', cost: 19, roles: ['TOP'], tags: ['tank', 'engage', 'cc-heavy', 'scaling-late'], ccScore: 3 },
  { id: 'pyke', name: 'Pyke', cost: 19, roles: ['SUPPORT'], tags: ['assassin', 'support', 'ad', 'engage', 'mobility'], ccScore: 2 },
  { id: 'qiyana', name: 'Qiyana', cost: 22, roles: ['MID', 'JUNGLE'], tags: ['assassin', 'ad', 'burst', 'mobility', 'cc-heavy'], ccScore: 2 },
  { id: 'rakan', name: 'Rakan', cost: 18, roles: ['SUPPORT'], tags: ['support', 'engage', 'disengage', 'mobility', 'ap'], ccScore: 3 },
  { id: 'rammus', name: 'Rammus', cost: 12, roles: ['JUNGLE'], tags: ['tank', 'engage', 'cc-heavy', 'scaling-early'], ccScore: 2 },
  { id: 'renekton', name: 'Renekton', cost: 18, roles: ['TOP'], tags: ['fighter', 'ad', 'sustain', 'scaling-early'], ccScore: 1 },
  { id: 'riven', name: 'Riven', cost: 21, roles: ['TOP'], tags: ['fighter', 'ad', 'mobility', 'burst', 'scaling-mid'], ccScore: 1 },
  { id: 'samira', name: 'Samira', cost: 22, roles: ['ADC'], tags: ['marksman', 'ad', 'engage', 'mobility', 'scaling-mid'], ccScore: 1 },
  { id: 'sejuani', name: 'Sejuani', cost: 17, roles: ['JUNGLE'], tags: ['tank', 'engage', 'cc-heavy', 'scaling-mid'], ccScore: 3 },
  { id: 'senna', name: 'Senna', cost: 18, roles: ['SUPPORT', 'ADC'], tags: ['marksman', 'support', 'ad', 'poke', 'scaling-late'], ccScore: 1 },
  { id: 'sett', name: 'Sett', cost: 17, roles: ['TOP', 'SUPPORT'], tags: ['fighter', 'tank', 'ad', 'engage', 'sustain'], ccScore: 2 },
  { id: 'shen', name: 'Shen', cost: 17, roles: ['TOP', 'SUPPORT'], tags: ['tank', 'support', 'disengage', 'scaling-mid'], ccScore: 2 },
  { id: 'soraka', name: 'Soraka', cost: 10, roles: ['SUPPORT'], tags: ['support', 'sustain', 'disengage', 'ap'], ccScore: 0 },
  { id: 'syndra', name: 'Syndra', cost: 20, roles: ['MID'], tags: ['mage', 'ap', 'burst', 'poke', 'cc-heavy'], ccScore: 1 },
  { id: 'taliyah', name: 'Taliyah', cost: 19, roles: ['MID', 'JUNGLE'], tags: ['mage', 'ap', 'poke', 'cc-heavy', 'scaling-mid'], ccScore: 2 },
  { id: 'thresh', name: 'Thresh', cost: 20, roles: ['SUPPORT'], tags: ['support', 'engage', 'disengage', 'cc-heavy'], ccScore: 3 },
  { id: 'tristana', name: 'Tristana', cost: 20, roles: ['ADC', 'MID'], tags: ['marksman', 'ad', 'mobility', 'scaling-late'], ccScore: 0 },
  { id: 'trundle', name: 'Trundle', cost: 15, roles: ['JUNGLE', 'TOP'], tags: ['fighter', 'tank', 'ad', 'sustain', 'scaling-early'], ccScore: 1 },
  { id: 'twitch', name: 'Twitch', cost: 18, roles: ['ADC'], tags: ['marksman', 'ad', 'scaling-late'], ccScore: 0 },
  { id: 'vayne', name: 'Vayne', cost: 22, roles: ['ADC', 'TOP'], tags: ['marksman', 'ad', 'scaling-late', 'mobility'], ccScore: 1 },
  { id: 'veigar', name: 'Veigar', cost: 18, roles: ['MID'], tags: ['mage', 'ap', 'burst', 'cc-heavy', 'scaling-late'], ccScore: 2 },
  { id: 'vi', name: 'Vi', cost: 18, roles: ['JUNGLE'], tags: ['fighter', 'ad', 'engage', 'cc-heavy', 'scaling-mid'], ccScore: 2 },
  { id: 'viktor', name: 'Viktor', cost: 21, roles: ['MID'], tags: ['mage', 'ap', 'poke', 'scaling-late'], ccScore: 1 },
  { id: 'wukong', name: 'Wukong', cost: 19, roles: ['TOP', 'JUNGLE'], tags: ['fighter', 'ad', 'engage', 'mobility', 'cc-heavy'], ccScore: 2 },
  { id: 'xayah', name: 'Xayah', cost: 21, roles: ['ADC'], tags: ['marksman', 'ad', 'scaling-late', 'disengage'], ccScore: 1 },
  { id: 'xerath', name: 'Xerath', cost: 17, roles: ['MID', 'SUPPORT'], tags: ['mage', 'ap', 'poke', 'scaling-mid'], ccScore: 1 },
  { id: 'yasuo', name: 'Yasuo', cost: 24, roles: ['MID', 'TOP'], tags: ['ad', 'fighter', 'mobility', 'scaling-mid'], ccScore: 1 },
  { id: 'yone', name: 'Yone', cost: 24, roles: ['MID', 'TOP'], tags: ['fighter', 'assassin', 'ad', 'ap', 'mobility', 'scaling-late'], ccScore: 1 },
  { id: 'yuumi', name: 'Yuumi', cost: 9, roles: ['SUPPORT'], tags: ['support', 'sustain', 'ap', 'scaling-late'], ccScore: 0 },
  { id: 'zac', name: 'Zac', cost: 17, roles: ['JUNGLE', 'TOP'], tags: ['tank', 'ap', 'engage', 'cc-heavy', 'sustain'], ccScore: 3 },
  { id: 'zed', name: 'Zed', cost: 24, roles: ['MID'], tags: ['assassin', 'ad', 'burst', 'mobility', 'scaling-mid'], ccScore: 0 },
  { id: 'zeri', name: 'Zeri', cost: 21, roles: ['ADC'], tags: ['marksman', 'ad', 'mobility', 'scaling-late'], ccScore: 0 },
  { id: 'zyra', name: 'Zyra', cost: 16, roles: ['SUPPORT', 'MID'], tags: ['mage', 'ap', 'poke', 'cc-heavy'], ccScore: 2 },

  // ---- Roster complet (voir demande produit : tous les champions du jeu, pas juste un sous-ensemble) ----
  { id: 'akshan', name: 'Akshan', cost: 20, roles: ['MID', 'TOP'], tags: ['assassin', 'marksman', 'ad', 'mobility', 'burst', 'scaling-mid'], ccScore: 0 },
  { id: 'alistar', name: 'Alistar', cost: 18, roles: ['SUPPORT'], tags: ['tank', 'support', 'engage', 'cc-heavy', 'sustain'], ccScore: 3 },
  { id: 'ambessa', name: 'Ambessa', cost: 22, roles: ['TOP'], tags: ['fighter', 'ad', 'mobility', 'engage', 'scaling-mid'], ccScore: 1 },
  { id: 'anivia', name: 'Anivia', cost: 19, roles: ['MID'], tags: ['mage', 'ap', 'cc-heavy', 'poke', 'scaling-late'], ccScore: 3 },
  { id: 'annie', name: 'Annie', cost: 16, roles: ['MID'], tags: ['mage', 'ap', 'burst', 'cc-heavy', 'scaling-early'], ccScore: 3 },
  { id: 'aphelios', name: 'Aphelios', cost: 23, roles: ['ADC'], tags: ['marksman', 'ad', 'scaling-late', 'burst'], ccScore: 0 },
  { id: 'aurelionsol', name: 'Aurelion Sol', cost: 20, roles: ['MID'], tags: ['mage', 'ap', 'poke', 'scaling-late', 'mobility'], ccScore: 1 },
  { id: 'aurora', name: 'Aurora', cost: 21, roles: ['MID', 'TOP'], tags: ['mage', 'ap', 'burst', 'mobility', 'scaling-mid'], ccScore: 1 },
  { id: 'bard', name: 'Bard', cost: 20, roles: ['SUPPORT'], tags: ['support', 'cc-heavy', 'disengage', 'mobility', 'engage'], ccScore: 3 },
  { id: 'belveth', name: "Bel'Veth", cost: 21, roles: ['JUNGLE'], tags: ['fighter', 'ad', 'mobility', 'scaling-late'], ccScore: 0 },
  { id: 'brand', name: 'Brand', cost: 17, roles: ['MID', 'SUPPORT'], tags: ['mage', 'ap', 'burst', 'poke', 'cc-heavy'], ccScore: 2 },
  { id: 'briar', name: 'Briar', cost: 20, roles: ['JUNGLE'], tags: ['fighter', 'assassin', 'ad', 'engage', 'mobility', 'burst'], ccScore: 1 },
  { id: 'cassiopeia', name: 'Cassiopeia', cost: 20, roles: ['MID'], tags: ['mage', 'ap', 'poke', 'cc-heavy', 'scaling-late'], ccScore: 2 },
  { id: 'chogath', name: "Cho'Gath", cost: 18, roles: ['TOP'], tags: ['tank', 'ap', 'cc-heavy', 'scaling-late', 'engage'], ccScore: 3 },
  { id: 'corki', name: 'Corki', cost: 18, roles: ['MID', 'ADC'], tags: ['marksman', 'ad', 'ap', 'poke', 'scaling-mid'], ccScore: 0 },
  { id: 'drmundo', name: 'Dr. Mundo', cost: 17, roles: ['TOP'], tags: ['tank', 'fighter', 'ad', 'sustain', 'scaling-late'], ccScore: 0 },
  { id: 'evelynn', name: 'Evelynn', cost: 21, roles: ['JUNGLE'], tags: ['assassin', 'ap', 'burst', 'mobility', 'scaling-mid'], ccScore: 1 },
  { id: 'fizz', name: 'Fizz', cost: 20, roles: ['MID'], tags: ['assassin', 'ap', 'burst', 'mobility', 'scaling-mid'], ccScore: 0 },
  { id: 'gangplank', name: 'Gangplank', cost: 19, roles: ['TOP'], tags: ['fighter', 'ad', 'poke', 'scaling-late', 'burst'], ccScore: 0 },
  { id: 'gnar', name: 'Gnar', cost: 20, roles: ['TOP'], tags: ['fighter', 'ad', 'cc-heavy', 'scaling-mid', 'mobility', 'engage'], ccScore: 2 },
  { id: 'gwen', name: 'Gwen', cost: 20, roles: ['TOP'], tags: ['fighter', 'ap', 'sustain', 'mobility', 'scaling-mid'], ccScore: 0 },
  { id: 'heimerdinger', name: 'Heimerdinger', cost: 17, roles: ['MID', 'SUPPORT'], tags: ['mage', 'ap', 'poke', 'cc-heavy', 'scaling-mid'], ccScore: 2 },
  { id: 'hwei', name: 'Hwei', cost: 21, roles: ['MID'], tags: ['mage', 'ap', 'poke', 'burst', 'cc-heavy', 'scaling-late'], ccScore: 2 },
  { id: 'illaoi', name: 'Illaoi', cost: 18, roles: ['TOP'], tags: ['fighter', 'ad', 'sustain', 'engage', 'scaling-mid'], ccScore: 1 },
  { id: 'jayce', name: 'Jayce', cost: 21, roles: ['TOP', 'MID'], tags: ['fighter', 'marksman', 'ad', 'poke', 'mobility', 'engage', 'scaling-mid'], ccScore: 1 },
  { id: 'ksante', name: "K'Sante", cost: 20, roles: ['TOP'], tags: ['tank', 'fighter', 'ad', 'engage', 'cc-heavy', 'disengage', 'scaling-late'], ccScore: 2 },
  { id: 'karma', name: 'Karma', cost: 17, roles: ['SUPPORT', 'MID'], tags: ['mage', 'support', 'ap', 'poke', 'disengage', 'scaling-mid'], ccScore: 1 },
  { id: 'karthus', name: 'Karthus', cost: 18, roles: ['MID', 'JUNGLE'], tags: ['mage', 'ap', 'poke', 'scaling-late', 'burst'], ccScore: 1 },
  { id: 'kassadin', name: 'Kassadin', cost: 19, roles: ['MID'], tags: ['mage', 'assassin', 'ap', 'burst', 'mobility', 'scaling-late'], ccScore: 1 },
  { id: 'kennen', name: 'Kennen', cost: 18, roles: ['TOP', 'MID'], tags: ['mage', 'ap', 'cc-heavy', 'burst', 'scaling-mid'], ccScore: 3 },
  { id: 'kled', name: 'Kled', cost: 19, roles: ['TOP'], tags: ['fighter', 'ad', 'engage', 'mobility', 'cc-heavy', 'scaling-early'], ccScore: 2 },
  { id: 'kogmaw', name: "Kog'Maw", cost: 19, roles: ['ADC'], tags: ['marksman', 'ad', 'ap', 'scaling-late', 'poke'], ccScore: 0 },
  { id: 'lillia', name: 'Lillia', cost: 19, roles: ['JUNGLE'], tags: ['mage', 'ap', 'cc-heavy', 'poke', 'scaling-mid'], ccScore: 2 },
  { id: 'malzahar', name: 'Malzahar', cost: 18, roles: ['MID'], tags: ['mage', 'ap', 'cc-heavy', 'poke', 'scaling-mid'], ccScore: 3 },
  { id: 'maokai', name: 'Maokai', cost: 18, roles: ['TOP', 'SUPPORT', 'JUNGLE'], tags: ['tank', 'ap', 'cc-heavy', 'engage', 'sustain'], ccScore: 3 },
  { id: 'masteryi', name: 'Master Yi', cost: 20, roles: ['JUNGLE'], tags: ['fighter', 'assassin', 'ad', 'mobility', 'scaling-late'], ccScore: 0 },
  { id: 'mel', name: 'Mel', cost: 19, roles: ['MID'], tags: ['mage', 'ap', 'burst', 'poke', 'scaling-mid'], ccScore: 1 },
  { id: 'milio', name: 'Milio', cost: 17, roles: ['SUPPORT'], tags: ['support', 'ap', 'sustain', 'disengage'], ccScore: 1 },
  { id: 'missfortune', name: 'Miss Fortune', cost: 19, roles: ['ADC'], tags: ['marksman', 'ad', 'poke', 'burst', 'scaling-mid'], ccScore: 1 },
  { id: 'mordekaiser', name: 'Mordekaiser', cost: 19, roles: ['TOP'], tags: ['fighter', 'mage', 'ap', 'sustain', 'engage', 'scaling-mid'], ccScore: 1 },
  { id: 'naafiri', name: 'Naafiri', cost: 20, roles: ['MID', 'JUNGLE'], tags: ['assassin', 'ad', 'burst', 'mobility', 'scaling-mid'], ccScore: 0 },
  { id: 'nasus', name: 'Nasus', cost: 17, roles: ['TOP'], tags: ['fighter', 'tank', 'ad', 'sustain', 'scaling-late'], ccScore: 1 },
  { id: 'neeko', name: 'Neeko', cost: 19, roles: ['MID', 'SUPPORT'], tags: ['mage', 'ap', 'cc-heavy', 'burst', 'engage'], ccScore: 2 },
  { id: 'nidalee', name: 'Nidalee', cost: 20, roles: ['JUNGLE'], tags: ['assassin', 'mage', 'ap', 'burst', 'mobility', 'poke', 'scaling-early'], ccScore: 0 },
  { id: 'nilah', name: 'Nilah', cost: 20, roles: ['ADC'], tags: ['fighter', 'marksman', 'ad', 'mobility', 'sustain', 'engage'], ccScore: 1 },
  { id: 'nunu', name: 'Nunu & Willump', cost: 16, roles: ['JUNGLE'], tags: ['tank', 'ap', 'cc-heavy', 'engage', 'scaling-mid'], ccScore: 3 },
  { id: 'olaf', name: 'Olaf', cost: 18, roles: ['TOP', 'JUNGLE'], tags: ['fighter', 'ad', 'sustain', 'scaling-mid'], ccScore: 0 },
  { id: 'pantheon', name: 'Pantheon', cost: 18, roles: ['TOP', 'MID', 'SUPPORT'], tags: ['fighter', 'ad', 'burst', 'engage', 'mobility', 'scaling-early'], ccScore: 1 },
  { id: 'poppy', name: 'Poppy', cost: 17, roles: ['TOP', 'SUPPORT', 'JUNGLE'], tags: ['tank', 'ad', 'cc-heavy', 'engage', 'disengage'], ccScore: 3 },
  { id: 'quinn', name: 'Quinn', cost: 18, roles: ['TOP', 'ADC'], tags: ['marksman', 'assassin', 'ad', 'mobility', 'poke', 'burst'], ccScore: 1 },
  { id: 'reksai', name: "Rek'Sai", cost: 18, roles: ['JUNGLE'], tags: ['fighter', 'ad', 'mobility', 'engage', 'scaling-mid'], ccScore: 1 },
  { id: 'rell', name: 'Rell', cost: 17, roles: ['SUPPORT'], tags: ['tank', 'support', 'ap', 'engage', 'cc-heavy', 'disengage'], ccScore: 3 },
  { id: 'renata', name: 'Renata Glasc', cost: 18, roles: ['SUPPORT'], tags: ['mage', 'support', 'ap', 'cc-heavy', 'poke', 'engage'], ccScore: 2 },
  { id: 'rengar', name: 'Rengar', cost: 20, roles: ['JUNGLE'], tags: ['assassin', 'ad', 'burst', 'mobility', 'engage', 'scaling-mid'], ccScore: 1 },
  { id: 'rumble', name: 'Rumble', cost: 19, roles: ['TOP', 'JUNGLE'], tags: ['fighter', 'mage', 'ap', 'burst', 'poke', 'scaling-mid'], ccScore: 1 },
  { id: 'ryze', name: 'Ryze', cost: 19, roles: ['MID'], tags: ['mage', 'ap', 'poke', 'mobility', 'scaling-late', 'cc-heavy'], ccScore: 2 },
  { id: 'seraphine', name: 'Seraphine', cost: 18, roles: ['SUPPORT', 'MID'], tags: ['mage', 'support', 'ap', 'poke', 'cc-heavy', 'scaling-mid'], ccScore: 2 },
  { id: 'shaco', name: 'Shaco', cost: 19, roles: ['JUNGLE'], tags: ['assassin', 'ad', 'burst', 'mobility', 'cc-heavy'], ccScore: 2 },
  { id: 'shyvana', name: 'Shyvana', cost: 18, roles: ['JUNGLE'], tags: ['fighter', 'ad', 'ap', 'scaling-mid', 'engage', 'sustain'], ccScore: 1 },
  { id: 'singed', name: 'Singed', cost: 17, roles: ['TOP'], tags: ['tank', 'ap', 'disengage', 'sustain', 'scaling-late'], ccScore: 1 },
  { id: 'sion', name: 'Sion', cost: 17, roles: ['TOP'], tags: ['tank', 'ap', 'cc-heavy', 'engage', 'sustain', 'scaling-late'], ccScore: 3 },
  { id: 'sivir', name: 'Sivir', cost: 18, roles: ['ADC'], tags: ['marksman', 'ad', 'poke', 'mobility', 'scaling-mid'], ccScore: 0 },
  { id: 'skarner', name: 'Skarner', cost: 18, roles: ['JUNGLE'], tags: ['tank', 'fighter', 'ap', 'cc-heavy', 'engage', 'scaling-mid'], ccScore: 3 },
  { id: 'smolder', name: 'Smolder', cost: 20, roles: ['ADC'], tags: ['marksman', 'mage', 'ad', 'ap', 'scaling-late', 'poke', 'burst'], ccScore: 0 },
  { id: 'sona', name: 'Sona', cost: 15, roles: ['SUPPORT'], tags: ['support', 'ap', 'poke', 'cc-heavy', 'sustain', 'scaling-mid'], ccScore: 2 },
  { id: 'swain', name: 'Swain', cost: 18, roles: ['MID', 'SUPPORT'], tags: ['mage', 'ap', 'cc-heavy', 'sustain', 'poke', 'scaling-mid'], ccScore: 2 },
  { id: 'sylas', name: 'Sylas', cost: 21, roles: ['MID', 'JUNGLE'], tags: ['mage', 'assassin', 'ap', 'burst', 'mobility', 'engage', 'scaling-mid'], ccScore: 1 },
  { id: 'tahmkench', name: 'Tahm Kench', cost: 18, roles: ['TOP', 'SUPPORT'], tags: ['tank', 'ad', 'sustain', 'engage'], ccScore: 1 },
  { id: 'talon', name: 'Talon', cost: 20, roles: ['MID', 'JUNGLE'], tags: ['assassin', 'ad', 'burst', 'mobility', 'scaling-mid'], ccScore: 0 },
  { id: 'taric', name: 'Taric', cost: 16, roles: ['SUPPORT'], tags: ['tank', 'support', 'ap', 'engage', 'cc-heavy', 'sustain'], ccScore: 3 },
  { id: 'teemo', name: 'Teemo', cost: 17, roles: ['TOP', 'SUPPORT'], tags: ['marksman', 'mage', 'ap', 'poke', 'disengage', 'scaling-mid'], ccScore: 1 },
  { id: 'tryndamere', name: 'Tryndamere', cost: 19, roles: ['TOP'], tags: ['fighter', 'ad', 'sustain', 'mobility', 'scaling-late'], ccScore: 0 },
  { id: 'twistedfate', name: 'Twisted Fate', cost: 18, roles: ['MID'], tags: ['mage', 'ap', 'poke', 'cc-heavy', 'scaling-mid', 'mobility'], ccScore: 2 },
  { id: 'udyr', name: 'Udyr', cost: 18, roles: ['JUNGLE'], tags: ['fighter', 'ad', 'ap', 'engage', 'cc-heavy', 'scaling-mid', 'sustain'], ccScore: 2 },
  { id: 'urgot', name: 'Urgot', cost: 18, roles: ['TOP'], tags: ['fighter', 'marksman', 'ad', 'cc-heavy', 'sustain', 'scaling-mid'], ccScore: 2 },
  { id: 'varus', name: 'Varus', cost: 19, roles: ['ADC', 'MID'], tags: ['marksman', 'mage', 'ad', 'ap', 'poke', 'cc-heavy', 'scaling-mid'], ccScore: 2 },
  { id: 'velkoz', name: "Vel'Koz", cost: 18, roles: ['MID', 'SUPPORT'], tags: ['mage', 'ap', 'poke', 'cc-heavy', 'burst', 'scaling-mid'], ccScore: 2 },
  { id: 'vex', name: 'Vex', cost: 19, roles: ['MID'], tags: ['mage', 'ap', 'burst', 'poke', 'cc-heavy', 'scaling-mid'], ccScore: 1 },
  { id: 'viego', name: 'Viego', cost: 21, roles: ['JUNGLE'], tags: ['fighter', 'assassin', 'ad', 'mobility', 'burst', 'scaling-mid', 'sustain'], ccScore: 1 },
  { id: 'vladimir', name: 'Vladimir', cost: 19, roles: ['MID'], tags: ['mage', 'ap', 'sustain', 'scaling-late', 'poke'], ccScore: 0 },
  { id: 'volibear', name: 'Volibear', cost: 18, roles: ['TOP', 'JUNGLE'], tags: ['fighter', 'tank', 'ad', 'engage', 'cc-heavy', 'sustain', 'scaling-mid'], ccScore: 2 },
  { id: 'warwick', name: 'Warwick', cost: 17, roles: ['JUNGLE'], tags: ['fighter', 'tank', 'ad', 'sustain', 'engage', 'cc-heavy', 'mobility'], ccScore: 2 },
  { id: 'xinzhao', name: 'Xin Zhao', cost: 18, roles: ['JUNGLE'], tags: ['fighter', 'ad', 'engage', 'cc-heavy', 'scaling-early', 'mobility'], ccScore: 2 },
  { id: 'yorick', name: 'Yorick', cost: 17, roles: ['TOP'], tags: ['fighter', 'tank', 'ad', 'sustain', 'scaling-late', 'engage'], ccScore: 1 },
  { id: 'ziggs', name: 'Ziggs', cost: 18, roles: ['MID', 'ADC'], tags: ['mage', 'ap', 'poke', 'burst', 'scaling-mid'], ccScore: 1 },
  { id: 'zilean', name: 'Zilean', cost: 17, roles: ['SUPPORT', 'MID'], tags: ['mage', 'support', 'ap', 'disengage', 'cc-heavy', 'scaling-late'], ccScore: 2 },
  { id: 'zoe', name: 'Zoe', cost: 19, roles: ['MID'], tags: ['mage', 'ap', 'burst', 'poke', 'cc-heavy', 'mobility', 'scaling-mid'], ccScore: 2 },
];

const ALL_ROLES: Role[] = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];

/** Seuils de percentile -> palier de rarete. Mythique reste volontairement tres rare (~2% du pool). */
function rarityForPercentile(pct: number): ChampionRarity {
  if (pct < 0.02) return 'mythique';
  if (pct < 0.08) return 'legendaire';
  if (pct < 0.22) return 'epique';
  if (pct < 0.42) return 'tres-rare';
  if (pct < 0.7) return 'rare';
  return 'commun';
}

/**
 * Repartit les champions en paliers de rarete, PAR ROLE, pour que chaque role
 * (TOP, JUNGLE, MID, ADC, SUPPORT) propose le meme ratio de raretes plutot
 * qu'une repartition globale (ou un role pouvait finir surrepresente en
 * mythiques/legendaires pendant qu'un autre n'avait quasi que des communs).
 *
 * Un champion multi-role (ex. Akali TOP+MID) n'a qu'une seule rarete/`cost` :
 * on calcule donc, pour chacun de ses roles, sa position relative (0 = le
 * plus fort du role, 1 = le plus faible) au sein du sous-pool de CE role, puis
 * on moyenne ces positions sur tous ses roles avant d'appliquer les seuils.
 * Ca "tire" les champions multi-role vers une position raisonnable au lieu de
 * les laisser dependre d'un seul role arbitraire, et ca garde chaque sous-pool
 * de role proche du ratio cible (voir demande produit).
 *
 * `cost` brut sert uniquement de proxy de puissance relative pour ce calcul :
 * reecrit ensuite avec le vrai prix escalade du palier obtenu.
 */
function assignRarityAndPrice(raw: Omit<Champion, 'rarity'>[]): Champion[] {
  const percentileByRole = new Map<Role, Map<string, number>>();
  for (const role of ALL_ROLES) {
    const inRole = [...raw].filter((c) => c.roles.includes(role)).sort((a, b) => b.cost - a.cost);
    const count = inRole.length;
    const map = new Map<string, number>();
    inRole.forEach((c, i) => map.set(c.id, count > 1 ? i / (count - 1) : 0));
    percentileByRole.set(role, map);
  }

  const avgPercentile = (c: Omit<Champion, 'rarity'>): number => {
    const values = c.roles.map((r) => percentileByRole.get(r)!.get(c.id)!);
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  };

  const withRarity = raw.map((champion) => ({
    ...champion,
    rarity: rarityForPercentile(avgPercentile(champion)),
  }));

  const byRarity = new Map<ChampionRarity, (Omit<Champion, 'rarity'> & { rarity: ChampionRarity })[]>();
  for (const champion of withRarity) {
    const list = byRarity.get(champion.rarity) ?? [];
    list.push(champion);
    byRarity.set(champion.rarity, list);
  }

  const priced: Champion[] = [];
  for (const [rarity, champions] of byRarity.entries()) {
    const [min, max] = RARITY_PRICE_RANGES[rarity];
    const sorted = [...champions].sort((a, b) => b.cost - a.cost);
    const count = sorted.length;
    sorted.forEach((champion, i) => {
      // Le plus fort du palier (cost brut le plus eleve) prend le haut de la fourchette.
      const t = count > 1 ? 1 - i / (count - 1) : 1;
      priced.push({ ...champion, cost: Math.round(min + t * (max - min)) });
    });
  }
  return priced;
}

export const CHAMPIONS: Champion[] = [...assignRarityAndPrice(CHAMPIONS_RAW), ...SBIRE_CHAMPIONS];

export const DEFAULT_DRAFT_BUDGET = 140;
