/*
  Module: game/difficulty.js
  Defines difficulty configs for each game level/world.
  Level 1 = exact current game parameters (nothing breaks).
  Levels 2-5 progressively increase challenge.
*/

export const LEVEL_CONFIGS = [
  {
    // ─── NIVEAU 1 : Monde de la Forêt ───────────────────────────────────
    // Paramètres identiques au jeu original — rien ne casse
    id: 1,
    name: 'Forêt des Débuts',
    description: 'Apprends les bases !',
    bannerTheme: [0, 1, 2],        // banner indices to use for bg rotation
    villageCount: 40,
    enemyFrequency: 0.28,          // prob. spawn ennemi par plateforme
    enemySpeedMin: 80,
    enemySpeedMax: 170,
    enemyTypes: ['walk1', 'fly1'],  // only basic enemies
    shooterChance: 0.0,            // no shooters on level 1
    bossEvery: 8,                  // boss every 8 villages
    bossHpMin: 2000,
    bossHpMax: 3200,
    platformGapMin: 60,
    platformGapMax: 220,
    platformWidthMin: 120,
    platformWidthMax: 320,
    coinFrequency: 0.25,           // decor: coins
    heartFrequency: 0.04,
    ammoFrequency: 0.08,
    clusterCount: 7,
    gravity: 1.0,                  // multiplier on base gravity (1.0 = normal)
    playerSpeedMultiplier: 1.0,
  },
  {
    // ─── NIVEAU 2 : Plaines Venteuses ───────────────────────────────────
    id: 2,
    name: 'Plaines Venteuses',
    description: 'Les ennemis patrouillent plus vite !',
    bannerTheme: [3, 4, 5],
    villageCount: 40,
    enemyFrequency: 0.38,          // +10% plus d'ennemis
    enemySpeedMin: 100,
    enemySpeedMax: 200,
    enemyTypes: ['walk1', 'fly1', 'beast'],
    shooterChance: 0.05,           // quelques tireurs
    bossEvery: 7,
    bossHpMin: 2500,
    bossHpMax: 4000,
    platformGapMin: 80,
    platformGapMax: 250,
    platformWidthMin: 100,
    platformWidthMax: 300,
    coinFrequency: 0.22,
    heartFrequency: 0.04,
    ammoFrequency: 0.09,
    clusterCount: 8,               // +1 plateforme par village
    gravity: 1.0,
    playerSpeedMultiplier: 1.0,
  },
  {
    // ─── NIVEAU 3 : Cavernes Obscures ───────────────────────────────────
    id: 3,
    name: 'Cavernes Obscures',
    description: 'Les tireurs apparaissent... Reste vigilant !',
    bannerTheme: [6, 7, 8],
    villageCount: 40,
    enemyFrequency: 0.48,
    enemySpeedMin: 110,
    enemySpeedMax: 220,
    enemyTypes: ['walk1', 'fly1', 'beast', 'fly2'],
    shooterChance: 0.12,
    bossEvery: 6,
    bossHpMin: 3000,
    bossHpMax: 5000,
    platformGapMin: 100,
    platformGapMax: 280,
    platformWidthMin: 90,
    platformWidthMax: 280,
    coinFrequency: 0.20,
    heartFrequency: 0.035,
    ammoFrequency: 0.10,
    clusterCount: 8,
    gravity: 1.05,                 // légère augmentation gravité
    playerSpeedMultiplier: 1.0,
  },
  {
    // ─── NIVEAU 4 : Pics de Glace ───────────────────────────────────────
    id: 4,
    name: 'Pics de Glace',
    description: 'Les ennemis rares se réveillent !',
    bannerTheme: [0, 3, 8],
    villageCount: 40,
    enemyFrequency: 0.58,
    enemySpeedMin: 130,
    enemySpeedMax: 260,
    enemyTypes: ['walk1', 'fly1', 'beast', 'fly2', 'fly3'],
    shooterChance: 0.18,
    bossEvery: 5,
    bossHpMin: 4000,
    bossHpMax: 6500,
    platformGapMin: 120,
    platformGapMax: 300,
    platformWidthMin: 80,
    platformWidthMax: 260,
    coinFrequency: 0.18,
    heartFrequency: 0.03,
    ammoFrequency: 0.08,
    clusterCount: 9,
    gravity: 1.08,
    playerSpeedMultiplier: 1.0,
  },
  {
    // ─── NIVEAU 5 : Sommet du Génie ─────────────────────────────────────
    id: 5,
    name: 'Sommet du Génie',
    description: 'Le vrai défi commence. Bonne chance !',
    bannerTheme: [2, 5, 9],
    villageCount: 40,
    enemyFrequency: 0.68,
    enemySpeedMin: 150,
    enemySpeedMax: 300,
    enemyTypes: ['walk1', 'beast', 'fly1', 'beast', 'fly2', 'fly3'],
    shooterChance: 0.25,
    bossEvery: 4,                  // boss très fréquents
    bossHpMin: 5500,
    bossHpMax: 9000,
    platformGapMin: 140,
    platformGapMax: 340,
    platformWidthMin: 70,
    platformWidthMax: 240,
    coinFrequency: 0.16,
    heartFrequency: 0.025,
    ammoFrequency: 0.07,
    clusterCount: 10,
    gravity: 1.12,
    playerSpeedMultiplier: 1.0,
  },
];

/** Returns config for a given level (1-indexed). Falls back to level 1. */
export function getLevelConfig(levelIndex) {
  const idx = Math.max(0, Math.min(levelIndex - 1, LEVEL_CONFIGS.length - 1));
  return LEVEL_CONFIGS[idx];
}

/** Total number of levels available */
export const TOTAL_LEVELS = LEVEL_CONFIGS.length;
