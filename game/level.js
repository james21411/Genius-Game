/*
Module: game/level.js
Holds world state, player defaults and level generation.
Supports multiple difficulty levels via difficulty.js configs.
*/
import { getLevelConfig, TOTAL_LEVELS } from './difficulty.js';

export const world = {
  width: 40000, // extended 10x longer
  height: 1200,
  platforms: [],
  enemies: [],
  coins: [],
  livres: [],    // book pickup objects (hint/explanation items)
  projectiles: [],
  bannerMap: [] // random banner index per village (filled by makeLevel)
};

export const PLAYER_W = 48;
export const PLAYER_H = 64;

export const player = {
  x: 100, y: 600,
  vx:0, vy:0,
  w: PLAYER_W, h: PLAYER_H,
  grounded:false,
  facing:1,
  lives:3,
  invulnerable:0,
  // keep last grounded Y so camera can ignore brief jump motion
  lastGroundY: 600,
  // track how many jumps have been used (reset when grounded)
  _jumpCount: 0
};

const rand = (a,b)=>Math.random()*(b-a)+a;

/** Currently active level config (default: level 1 = original game) */
export let currentLevelConfig = getLevelConfig(1);

/** Set the active level before calling makeLevel() */
export function setLevel(levelIndex) {
  currentLevelConfig = getLevelConfig(levelIndex);
}

export function makeLevel(){
  // clear existing
  world.platforms = [];
  world.enemies = [];
  world.coins = [];
  world.livres = [];
  world.projectiles = [];

  const cfg = currentLevelConfig;
  const villageCount = cfg.villageCount || 40;
  const villageWidth = Math.floor(world.width / villageCount);
  let globalX = 0;

  // Build bannerMap so each banner (except banner7) is used,
  // and each chosen banner repeats 15 times consecutively.
  const allBannerIndices = [];
  for(let i=0;i<10;i++){
    // exclude banner7 (the 7th banner: index 6)
    if(i === 6) continue;
    allBannerIndices.push(i);
  }

  // shuffle available banners to create a random ordering
  function shuffle(arr){
    for(let i = arr.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  const ordered = shuffle(allBannerIndices.slice());

  // create bannerMap by repeating each banner 15 times in sequence
  const repeatCount = 15;
  world.bannerMap = [];
  let idx = 0;
  while(world.bannerMap.length < villageCount){
    const bannerIndex = ordered[idx % ordered.length];
    for(let r = 0; r < repeatCount && world.bannerMap.length < villageCount; r++){
      world.bannerMap.push(bannerIndex);
    }
    idx++;
  }

  for(let v = 0; v < villageCount; v++){
    // banner theme cycles through the level's configured banner indices
    const bannerPool = cfg.bannerTheme || [0,1,2];
    const theme = Math.floor(Math.random() * 5);
    const baseY = 760 - v*6; // slight progressive change per village

    world.platforms.push({x: globalX, y: baseY, w: villageWidth + 40, h: 600, type:'ground', theme});
    let x = globalX + 120;
    const clusterCount = cfg.clusterCount || 7;
    for(let i=0;i<clusterCount;i++){
      const w = Math.round(rand(cfg.platformWidthMin||120, cfg.platformWidthMax||320));
      const gap = Math.round(rand(cfg.platformGapMin||60, cfg.platformGapMax||220));
      const tallFactor = Math.random() < 0.25 ? rand(320,520) : rand(80,300);
      const y = baseY - Math.round(tallFactor * Math.sin(i*0.5) - rand(0,80));
      const plat = {x, y, w, h:24, type:'platform', theme};

      // ── Quiz platform : 1 par village (cluster i===3, villages pairs) ──────
      let isQuizPlat = (i === 3 && v % 2 === 0);
      
      // En mode "Monde Ouvert", on désactive les quiz
      if (window.gameMode === 'free') {
        isQuizPlat = false;
      }

      if (isQuizPlat) {
        plat.type            = 'quiz_platform';
        plat._quizTriggered  = false;  // reset chaque génération
        if (cfg.id === 1 && v === 0) plat.isTutorial = true;
        // Pas de décor ni ennemi sur les plateformes quiz
        world.platforms.push(plat);
        x += w + gap;
        continue;
      }

      const decorRoll = Math.random();
      if(decorRoll < (cfg.coinFrequency||0.25)) plat.decor = 'coins';
      if(decorRoll > 0.82) plat.decor = 'enemy';
      world.platforms.push(plat);


      // Pickup generation (Coins, Hearts, Ammo) — rates driven by difficulty config
      const heartChance  = cfg.heartFrequency  || 0.04;
      const ammoChance   = cfg.ammoFrequency   || 0.08;
      const pickupRoll = Math.random();
      if(pickupRoll < 0.55){
        if(pickupRoll < heartChance){
          world.coins.push({x: x + w/2, y: y-36, r:12, collected:false, isHeart: true});
        } else if(pickupRoll < heartChance + ammoChance){
          const ammoGain = 1 + Math.floor(Math.random() * 5);
          world.coins.push({x: x + w/2, y: y-36, r:11, collected:false, isAmmo: true, ammo: ammoGain});
        } else {
          const coinCount = Math.floor(w/80);
          for(let c=0;c<coinCount;c++){
            world.coins.push({x: x + 16 + c*(w/(coinCount||1)), y: y-36, r:10, collected:false});
          }
        }
      }

      // Enemy spawn — frequency and type pool driven by difficulty config
      if(Math.random() < (cfg.enemyFrequency || 0.28)){
        const pool = cfg.enemyTypes || ['walk1','fly1'];
        const etype = pool[Math.floor(Math.random() * pool.length)];
        const shooterChance = cfg.shooterChance || 0.0;
        const shooter = Math.random() < shooterChance;
        const speedMin = cfg.enemySpeedMin || 80;
        const speedMax = cfg.enemySpeedMax || 170;
        world.enemies.push({
          x: x + Math.min(120,w-40),
          y: y-48,
          w:40, h:48,
          dir:Math.random()<0.5?-1:1,
          speed: speedMin + Math.random() * (speedMax - speedMin),
          theme,
          type: etype,
          shooter,
          flying: etype.startsWith('fly')
        });
      }
      // Book spawn: 1 per village every 3 villages, placed above the first platform
      // so the player has time to read hints before reaching the quiz platform
      if (i === 1 && v % 3 === 0 && window.gameMode !== 'free') {
        world.livres.push({
          x: x + w / 2,
          y: y - 52,
          r: 18,         // collision radius
          collected: false
        });
      }

      x += w + gap;
    }

    const peakX = globalX + villageWidth - 220;
    const peakY = baseY - 520 - Math.round(rand(0,140));
    world.platforms.push({x: peakX, y: peakY, w:220, h:28, type:'peak', theme: theme});

    // Spawn a boss at milestones — frequency defined by difficulty config
    const bossEvery = cfg.bossEvery || 8;
    if(v % bossEvery === (bossEvery - 1)){
      const bx = Math.min(globalX + Math.floor(villageWidth/2), world.width - 400);
      // Position bosses a bit lower than the highest peak so they don't appear offscreen or force awkward camera jumps.
      // Nudge bosses further down so they're more visible on screen.
      let by = peakY - 200 + 60;
      // Clamp boss vertical position to a sensible play area
      by = Math.max(220, Math.min(by, world.height - 220));
      const bossIndex = Math.floor(Math.random() * 5); // 0..4 -> boss sprites
      const bossHp = (cfg.bossHpMin||2000) + Math.floor(Math.random()*((cfg.bossHpMax||3200)-(cfg.bossHpMin||2000)));
      world.enemies.push({
        x: bx,
        y: by,
        w: 160, h: 160,
        dir: Math.random()<0.5?-1:1,
        speed: 30 + Math.random()*40,
        theme,
        type: 'boss' + (bossIndex+1),
        boss: true,
        hp: bossHp,
        maxHp: bossHp,
        shooter: true,
        flying:false
      });
    }

    globalX += villageWidth;
  }

  world.platforms.push({x: world.width - 340, y: 760 - 420, w:300, h:32, type:'goal', theme:0});
}

// ensureGenerated(aheadX):
// When called with an x ahead position, add a few higher (smaller y) platform clusters
// above existing platforms so players who climb can continue ascending.
export function ensureGenerated(aheadX){
  // avoid calling too often: only generate around the given aheadX window
  const searchX = Math.max(0, Math.floor(aheadX));
  // find current highest platform (smallest y)
  let minY = Infinity;
  for(const p of world.platforms) if(p.y < minY) minY = p.y;
  if(!isFinite(minY)) minY = 400;

  // If the highest platform is still relatively low (i.e. there's room above), spawn some higher platforms
  // We only create extra vertical content if the current minY is greater than a threshold.
  if(minY > 180){
    // create 3-5 floating platforms spanning the region around searchX
    const count = 3 + Math.floor(Math.random()*3);
    let px = searchX - 200;
    for(let i=0;i<count;i++){
      const w = 120 + Math.floor(Math.random()*200);
      // place platforms higher (smaller y value), staggered upward
      const y = Math.max(60, Math.round(minY - 140 - Math.random()*220 - i*40));
      const gap = 160 + Math.round(Math.random()*240);
      world.platforms.push({x: px, y, w, h:20, type:'platform', theme: Math.floor(Math.random()*5)});
      // occasionally add coins or enemy on those platforms
      if(Math.random() < 0.5){
        const coinCount = Math.max(1, Math.floor(w/90));
        for(let c=0;c<coinCount;c++){
          world.coins.push({x: px + 12 + c*(w/(coinCount||1)), y: y-36, r:10, collected:false});
        }
      }
      if(Math.random() < 0.18){
        const roll = Math.random();
        let etype = 'walk1';
        if(roll < 0.5) etype = 'walk1';
        else if(roll < 0.85) etype = 'fly1';
        else etype = 'fly2';
        const shooter = (etype === 'fly2') && Math.random() < 0.12;
        world.enemies.push({
          x: px + Math.min(60,w-40),
          y: y-48,
          w:40, h:48,
          dir:Math.random()<0.5?-1:1,
          speed:70 + Math.random()*80,
          type: etype,
          shooter,
          flying: etype.startsWith('fly')
        });
      }
      px += w + gap;
    }
    // expand world.height a bit to ensure camera clamping works with new content
    // (we only increase if needed)
    const minAllowed = 0;
    if(world.height < 1400) world.height = 1400;
  }
}