/*
Module: game/assets.js
Simplified loader: only uses the local platform.png as the single platform variant,
and loads the existing local assets bundled with the project.
*/
export const assets = {
  player: new Image(),
  platformVariants: [], // will contain only the local platform.png
  coin: new Image(),
  enemy: new Image(), // legacy single enemy fallback
  enemyWalk: [],     // walking enemy sprites (common -> rare)
  enemyFly: [],      // flying enemy sprites (common -> rare)
  banners: [],
  projectilePlayer: new Image(),
  digits: new Image(),
  bosses: [],
  livre: new Image(),
  scroll_fragment: new Image(),
  knowledge_crystal: new Image(),
  switch_button: new Image(),
  door_closed: new Image(),
  npc_sage: new Image(),
  saw_on: new Image(),
  spike_head: new Image(),
  ninja_frog_idle: new Image(),
  ninja_frog_run: new Image(),
  terrain_sheet: new Image(),
  trampoline_idle: new Image(),
  trampoline_jump: new Image()
};

let assetsLoaded = 0;

 // concise local-only asset list (no external downloads)
const assetList = [
  {key: 'player', img: assets.player, src: 'mon_sp_clean.png'},
  {key: 'coin', img: assets.coin, src: 'coin.png'},
  {key: 'enemy', img: assets.enemy, src: 'enemy.png'},
  // walking / flying enemies
  {key: 'walk1', src: 'enemy_walk1.png'},
  {key: 'fly1', src: 'enemy_fly1.png'},
  {key: 'fly2', src: 'enemy_fly2.png'},
  {key: 'fly3', src: 'enemy_fly3.png'},
  // platform tiles: only use the original single platform texture
  {key: 'plat1', src: 'platform.png'},
  // banners (local project banners only)
  {key: 'banner1', src: 'banner1.jpg'},
  {key: 'banner2', src: 'banner2.jpg'},
  {key: 'banner3', src: 'banner3.jpg'},
  {key: 'banner4', src: 'banner4.jpg'},
  {key: 'banner5', src: 'banner5.jpeg'},
  {key: 'banner6', src: 'banner6.jpeg'},
  {key: 'banner7', src: 'banner7.jpeg'},
  {key: 'banner8', src: 'banner8.jpg'},
  {key: 'banner9', src: 'banner9.png'},
  {key: 'banner10', src: 'banner10.png'},
  // UI/projectile/digits/menu/gameover/bosses (local)
  {key: 'projectile', src: 'projectile.png'},
  {key: 'digits', src: 'digits.png'},
  {key: 'menu', src: 'banner11.jpg'},
  {key: 'gameover', src: 'banner9.png'},
  {key: 'boss1', src: 'boss1.png'},
  {key: 'boss2', src: 'boss2.png'},
  {key: 'boss3', src: 'boss3.png'},
  {key: 'boss4', src: 'boss4.png'},
  {key: 'boss5', src: 'boss5.png'},
  {key: 'livre', img: assets.livre, src: 'livre1.jpeg'},
  {key: 'scroll_fragment', img: assets.scroll_fragment, src: 'scroll_fragment.png'},
  {key: 'knowledge_crystal', img: assets.knowledge_crystal, src: 'knowledge_crystal.png'},
  {key: 'switch_button', img: assets.switch_button, src: 'switch_button.png'},
  {key: 'door_closed', img: assets.door_closed, src: 'door_closed.png'},
  {key: 'npc_sage', img: assets.npc_sage, src: 'npc_sage.png'},
  {key: 'saw_on', img: assets.saw_on, src: 'Saw/On (38x38).png'},
  {key: 'spike_head', img: assets.spike_head, src: 'Spike Head/Blink (54x52).png'},
  {key: 'ninja_frog_idle', img: assets.ninja_frog_idle, src: 'Ninja Frog/Idle (32x32).png'},
  {key: 'ninja_frog_run', img: assets.ninja_frog_run, src: 'Ninja Frog/Run (32x32).png'},
  {key: 'terrain_sheet', img: assets.terrain_sheet, src: 'Terrain/Terrain (16x16).png'},
  {key: 'trampoline_idle', img: assets.trampoline_idle, src: 'Trampoline/Idle.png'},
  {key: 'trampoline_jump', img: assets.trampoline_jump, src: 'Trampoline/Jump (28x28).png'}
];

export function initAssets(){
  for(const a of assetList){
    // direct-assigned Image objects (player, coin, enemy)
    if(a.key && a.img){
      a.img.src = a.src;
      a.img.onload = ()=>{ assetsLoaded++; };
      a.img.onerror = ()=>{ assetsLoaded++; };
      continue;
    }

    // banners
    if(a.key && a.key.startsWith('banner')){
      const img = new Image();
      img.src = a.src;
      img.onload = ()=>{ assetsLoaded++; };
      img.onerror = ()=>{ assetsLoaded++; };
      assets.banners.push(img);
      continue;
    }

    // platform variants: any key starting with 'plat' will be loaded into platformVariants
    if(a.key && a.key.startsWith('plat')){
      const img = new Image();
      img.src = a.src;
      img.onload = ()=>{
        assets.platformVariants.push(img);
        assetsLoaded++;
      };
      img.onerror = ()=>{
        // still count as loaded and push the image object (even if errored)
        assets.platformVariants.push(img);
        assetsLoaded++;
      };
      continue;
    }

    if(a.key && a.key.startsWith('walk')){
      const img = new Image();
      img.src = a.src;
      img.onload = ()=>{ assetsLoaded++; };
      img.onerror = ()=>{ assetsLoaded++; };
      assets.enemyWalk.push(img);
      continue;
    }

    if(a.key && a.key.startsWith('fly')){
      const img = new Image();
      img.src = a.src;
      img.onload = ()=>{ assetsLoaded++; };
      img.onerror = ()=>{ assetsLoaded++; };
      assets.enemyFly.push(img);
      continue;
    }

    if(a.key === 'menu'){
      const img = new Image();
      img.src = a.src;
      img.onload = ()=>{ assetsLoaded++; };
      img.onerror = ()=>{ assetsLoaded++; };
      assets.menu = img;
      continue;
    }

    if(a.key === 'gameover'){
      const img = new Image();
      img.src = a.src;
      img.onload = ()=>{ assetsLoaded++; };
      img.onerror = ()=>{ assetsLoaded++; };
      assets.gameover = img;
      continue;
    }

    if(a.key === 'projectile'){
      const img = new Image();
      img.src = a.src;
      img.onload = ()=>{ assetsLoaded++; };
      img.onerror = ()=>{ assetsLoaded++; };
      assets.projectilePlayer = img;
      continue;
    }

    if(a.key === 'digits'){
      const img = new Image();
      img.src = a.src;
      img.onload = ()=>{ assetsLoaded++; };
      img.onerror = ()=>{ assetsLoaded++; };
      assets.digits = img;
      continue;
    }

    if(a.key && a.key.startsWith('boss')){
      const img = new Image();
      img.src = a.src;
      img.onload = ()=>{ assetsLoaded++; };
      img.onerror = ()=>{ assetsLoaded++; };
      assets.bosses.push(img);
      continue;
    }

    // generic fallback loader (shouldn't be hit with the concise list)
    const img = new Image();
    img.src = a.src;
    img.onload = ()=>{ assetsLoaded++; };
    img.onerror = ()=>{ assetsLoaded++; };
  }
}

// returns true when all expected assets have completed loading (or errored)
export function assetsReady(){
  return assetsLoaded >= assetList.length;
}