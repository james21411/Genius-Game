/*
Module: game/engine.js
Contains physics, collisions, HUD updates and game loop start.
Integrates quiz_engine for educational platform triggers.
*/
import { world, player } from './level.js';
import { input } from './controls.js';
import { assetsReady } from './assets.js';
import { draw } from './render.js';
import { isQuizActive, timeScale, updateQuiz, triggerQuiz } from './quiz_engine.js';
import { playJump, playCollect, playLose, startMusic, pauseMusic, stopMusic } from './sound.js';

const GRAVITY = 2200;
const MOVE_ACC = 2600;
const MAX_VX = 460;
const JUMP_V = 880;
const JUMP_HOLD_GRAVITY = 900;
const JUMP_HOLD_TIME = 0.18;
const FRICTION = 0.85;

const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
let score = 0;
// player shooting / ammo
player.ammo = player.ammo || 30;
let floatingAmmoTexts = []; // temporary floating pickup text
window.floatingAmmoTexts = floatingAmmoTexts;
// track jump button previous state to detect presses for double-jump
let _prevJumpPressed = false;

function itemEffects(){
  return window.getStudentItemEffects?.() || window.studentItemEffects || {};
}

function timedEffectActive(key){
  return Date.now() < (itemEffects()[key] || 0);
}

function rectsOverlap(a,b){
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function respawn(){
  player.x = 100;
  player.y = 360;
  player.vx = 0; player.vy = 0;
  if (player.lives === 3) {
    score = 0;
    window.__scoreForRender = 0;
    player.coins = 0;
    player.aiQueries = 1;
    window.levelTimer = 600; // Reset timer on full restart
  }
}
function respawnBrief(){
  respawn();
  player.invulnerable = 1.2;
}
async function resetGame(){
  score = 0;
  // keep player lives large to avoid death
  player.lives = 9999;
  world.enemies = [];
  world.coins = [];
  world.platforms = [];
  const mod = await awaitImportLevel();
  if(mod && typeof mod.makeLevel === 'function'){
    mod.makeLevel();
  }
  respawn();
}

// simple lazy import helper so we avoid circular static import
function awaitImportLevel(){
  // dynamic import to break cycles (level.js has no dependency on engine)
  return import('./level.js');
}

let last = performance.now();

export function startEngine(canvas, worldRef, playerRef){
  respawn();
  last = performance.now();
  requestAnimationFrame(loop);
}

let _gameoverUiSynced = false;

function loop(now){
  const rawDt = Math.min(0.032, (now - last) / 1000);
  last = now;

  if (window.gameState === 'gameover' && !_gameoverUiSynced) {
    _gameoverUiSynced = true;
    window.updateMenuVisibility?.();
  } else if (window.gameState !== 'gameover') {
    _gameoverUiSynced = false;
  }

  // if not playing, only render (keeps canvas interactive for menu/gameover)
  if(window.gameState && window.gameState !== 'playing'){
    if (window.gameState === 'gameover') {
      stopMusic();
    } else {
      pauseMusic();
    }
    if(player.invulnerable > 0) player.invulnerable -= rawDt;
    draw();
    requestAnimationFrame(loop);
    return;
  }

  // Reading or answering pauses the world: enemies, projectiles and level timer stay still.
  if(window.isLivreActive){
    draw();
    requestAnimationFrame(loop);
    return;
  }

  if(isQuizActive()){
    updateQuiz(rawDt);
    draw();
    requestAnimationFrame(loop);
    return;
  }

  // Ensure game music is playing when active
  startMusic();

  const dt = rawDt * timeScale();
  updateQuiz(rawDt); // quiz updates at real time

  if (typeof window.levelTimer === 'number') {
    // Only decrement timer if game is not paused by quiz (dt controls this nicely)
    window.levelTimer -= dt;
    if (window.levelTimer <= 0) {
      window.levelTimer = 0;
      window.gameState = 'gameover';
    }
  }

  // horizontal control
  let moveDir = 0;
  if(input.left) moveDir = -Math.abs(input.left);
  if(input.right) moveDir = Math.abs(input.right);
  if(!moveDir){
    player.vx *= FRICTION;
  } else {
    player.vx += moveDir * MOVE_ACC * dt;
    player.facing = moveDir < 0 ? -1 : 1;
  }
  player.vx = Math.max(-MAX_VX, Math.min(MAX_VX, player.vx));

  // jump logic (supports double-jump)
  // trigger on press (rising edge) so holding doesn't repeatedly consume jumps
  const jumpPressed = !!input.jump;
  if(jumpPressed && !_prevJumpPressed){
    // initial ground jump
    if(player.grounded){
      player.vy = -JUMP_V;
      player.grounded = false;
      player._jumpHold = JUMP_HOLD_TIME;
      player._jumpCount = 1;
      playJump();
    } else if((player._jumpCount || 0) < (timedEffectActive('jumpBootsUntil') ? 3 : 2)){
      // mid-air double jump (slightly reduced power)
      player.vy = -JUMP_V * 0.82;
      player._jumpHold = JUMP_HOLD_TIME * 0.6;
      player._jumpCount = (player._jumpCount || 0) + 1;
      playJump();
    }
  } else if(jumpPressed && player._jumpHold > 0 && player.vy < 0){
    // holding jump prolongs upward velocity a bit
    player._jumpHold -= dt;
  }

  // gravity (simple)
  player.vy += GRAVITY * dt;

  // remember previous position before integrating motion (fixes jump/platform collision timing)
  const prevY = player.y;
  const prevX = player.x;

  // integrate
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // world bounds & fall handling (no permanent death)
  if(player.x < 0) player.x = 0, player.vx = 0;
  if(player.x + player.w > world.width) player.x = world.width - player.w, player.vx = 0;
  if(player.y > world.height + 600){
    // fall now costs a life
    player.lives = Math.max(0, player.lives - 1);
    playLose();
    floatingAmmoTexts.push({x: player.x, y: player.y - 20, t: 1.2, text: '-1 VIE'});
    if(player.lives <= 0){
      window.gameState = 'gameover';
    } else {
      respawnBrief();
    }
  }

  // ensure more level is generated ahead of the player for near-infinite feel
  // request the level module and call ensureGenerated up to some distance ahead
  {
    const ahead = player.x + (innerWidth * 2) + 2000;
    awaitImportLevel().then(mod => {
      if(mod && typeof mod.ensureGenerated === 'function'){
        try{ mod.ensureGenerated(ahead); }catch(e){}
      }
    });
  }

  // collisions with platforms
  player.grounded = false;
  const pbox = {x: player.x, y: player.y, w: player.w, h: player.h};
  for(const plat of world.platforms){
    const platBox = {x:plat.x, y:plat.y, w:plat.w, h:plat.h};
    if(pbox.x + pbox.w > platBox.x && pbox.x < platBox.x + platBox.w){
      if(prevY + player.h <= platBox.y && pbox.y + pbox.h >= platBox.y){
        player.y = platBox.y - player.h;
        player.vy = 0;
        player.grounded = true;
        player.lastGroundY = player.y;

        // ── Déclencher quiz si plateforme quiz non encore répondue ──────────
        if(plat.type === 'quiz_platform' && !plat._quizTriggered && !isQuizActive()){
          triggerQuiz(plat, (wasCorrect) => {
            // Bonus vie si bonne réponse (optionnel)
            if(wasCorrect) score += 200;
          });
        }
      }
    }
  }
  // reset jump count when we land
  if(player.grounded){
    player._jumpCount = 0;
  }

  if (world.trampolines) {
    for(const t of world.trampolines){
       if(t.triggered > 0) t.triggered -= dt;
       if(player.vy >= 0 && rectsOverlap(pbox, {x: t.x, y: t.y, w: t.w, h: t.h})) {
           player.vy = -JUMP_V * 1.5; // huge bounce
           player.grounded = false;
           t.triggered = 0.5;
           playCollect(); // bounce sound
       }
    }
  }

  // enemies - movement, shooting, collision (stomp) and simple bounce; enemies can spawn projectiles
  const enemiesFrozen = timedEffectActive('enemyFreezeUntil');
  for(const e of world.enemies){
    const enemyDt = enemiesFrozen ? 0 : dt;
    // movement
    if(e.type === 'saw' || e.type === 'spike_head') {
      e.progress += enemyDt * (e.speed / 50);
      const offset = (Math.sin(e.progress) + 1) / 2;
      
      const distY = (e.endY || e.startY) - (e.startY || e.y);
      e.y = (e.startY || e.y) + offset * distY;
      
      const distX = (e.endX || e.startX) - (e.startX || e.x);
      if (distX !== 0) {
         e.x = (e.startX || e.x) + offset * distX;
      }
    } else if (e.type === 'ninja_frog') {
      e.timer = (e.timer || 0) + enemyDt;
      if (e.timer > 2.0 && e.grounded !== false) {
         e.vy = -JUMP_V * 0.8;
         e.timer = 0;
         e.grounded = false;
      }
      e.vy = (e.vy || 0) + GRAVITY * enemyDt;
      e.y += e.vy * enemyDt;
      e.x += e.dir * e.speed * enemyDt;
      let grounded = false;
      for (const p of world.platforms) {
          if (e.vy > 0 && e.y + e.h <= p.y + 10 && e.y + e.h + e.vy*enemyDt >= p.y && e.x + e.w > p.x && e.x < p.x + p.w) {
              e.y = p.y - e.h;
              e.vy = 0;
              grounded = true;
          }
      }
      e.grounded = grounded;
      if(!grounded || e.x < 0 || e.x + e.w > world.width) {
        if (e.x < 0 || e.x + e.w > world.width) e.dir *= -1;
      } else {
        const under = world.platforms.find(p => (e.x + e.w/2) >= p.x && (e.x + e.w/2) <= (p.x + p.w) && Math.abs((p.y) - (e.y + e.h)) < 40);
        if (!under) e.dir *= -1;
      }
    } else if(e.flying){
      e.x += e.dir * e.speed * enemyDt;
      if(e.x < 0 || e.x + e.w > world.width) e.dir *= -1;
    } else {
      e.x += e.dir * e.speed * enemyDt;
      const under = world.platforms.find(p => (e.x + e.w/2) >= p.x && (e.x + e.w/2) <= (p.x + p.w) && Math.abs((p.y) - (e.y + e.h)) < 40);
      if(!under || e.x < 0 || e.x + e.w > world.width) e.dir *= -1;
    }

    // shooting behavior (if marked shooter)
    if(e.shooter){
      e._shootTimer = (e._shootTimer || (1.2 + Math.random()*2.0)) - enemyDt;
      if(e._shootTimer <= 0){
        e._shootTimer = 1.2 + Math.random()*2.4;
        // spawn a projectile aimed roughly at the player
        const px = e.x + e.w/2;
        const py = e.y + (e.flying ? e.h/2 : -12);
        const dx = (player.x + player.w/2) - px;
        const dy = (player.y + player.h/2) - py;
        const len = Math.max(60, Math.hypot(dx,dy));
        const speed = 320 + Math.random()*120;
        const vx = dx / len * speed;
        const vy = dy / len * speed * 0.9;
        world.projectiles.push({
          x: px,
          y: py,
          vx, vy,
          r: 8,
          life: 4.0,
          hostile: true,
          from: e
        });
      }
    }

    // Bosses perform occasional combo bursts (multiple projectiles in a spread)
    if(e.boss){
      e._comboTimer = (e._comboTimer || (3.0 + Math.random()*3.0)) - enemyDt;
      if(e._comboTimer <= 0){
        // reset with some variance
        e._comboTimer = 4.0 + Math.random()*4.0;
        const shots = 5 + Math.floor(Math.random()*4); // burst count
        const spread = 0.6 + Math.random()*0.8; // angular spread
        const px = e.x + e.w/2;
        const py = e.y + Math.floor(e.h/2);
        // fire a fan aimed at player center
        const targetAngle = Math.atan2((player.y + player.h/2) - py, (player.x + player.w/2) - px);
        for(let s = 0; s < shots; s++){
          const frac = (s/(shots-1 || 1)) - 0.5;
          const ang = targetAngle + frac * spread;
          const speed = 260 + Math.random()*140;
          const vx = Math.cos(ang) * speed;
          const vy = Math.sin(ang) * speed;
          world.projectiles.push({
            x: px,
            y: py,
            vx, vy,
            r: 12,
            life: 5.0,
            hostile: true,
            from: e
          });
        }
      }
    }

    const enemyBox = {x:e.x,y:e.y,w:e.w,h:e.h};
    if(rectsOverlap(pbox, enemyBox) && player.invulnerable <= 0){
      if(player.vy > 150 && e.type !== 'saw' && e.type !== 'spike_head' && e.type !== 'fire'){
        // stomp
        player.vy = -JUMP_V*0.6;
        e.dead = true;
        score += 150;
      } else {
        // enemy contact now costs a life
        if (e.type === 'saw' || e.type === 'spike_head' || e.type === 'fire') {
            player.lives = Math.max(0, player.lives - 1);
            player.coins = Math.max(0, (player.coins || 0) - 5);
            playLose();
            floatingAmmoTexts.push({x: player.x, y: player.y - 20, t: 1.2, text: '-1 VIE / -5 🪙'});
        } else {
            player.lives = Math.max(0, player.lives - 1);
            playLose();
            floatingAmmoTexts.push({x: player.x, y: player.y - 20, t: 1.2, text: '-1 VIE'});
        }
        player.invulnerable = 1.2;
        player.vy = -JUMP_V*0.4;
        player.x += (e.dir > 0 ? -48 : 48);
        // check for game over
        if(player.lives <= 0){
          // trigger game over state and pause progression (engine loop will continue but skip simulation)
          window.gameState = 'gameover';
          // optionally drop a visual coin/banners etc.
        }
      }
    }
  }
  world.enemies = world.enemies.filter(e=>!e.dead);

  // player shooting (spawn projectiles when input.shoot and has ammo)
  if(input.shoot && player.ammo > 0){
    // consume ammo and spawn a short-lived projectile
    input.shoot = false; // single-shot per press
    player.ammo = Math.max(0, player.ammo - 1);
    const dir = player.facing || 1;
    world.projectiles.push({
      x: player.x + player.w/2 + dir*20,
      y: player.y + player.h/2 - 8,
      vx: dir * (420 + Math.random()*80),
      vy: -40 + Math.random()*20,
      r: 8,
      life: 2.6,
      hostile: false,
      from: player,
      damage: 180
    });
  }

  // projectiles update & collisions
  if(!world.projectiles) world.projectiles = [];
  for(const proj of world.projectiles){
    const projectileDt = proj.hostile && enemiesFrozen ? 0 : dt;
    proj.x += proj.vx * projectileDt;
    proj.y += proj.vy * projectileDt;
    proj.vy += GRAVITY * (proj.hostile ? 0.28 : 0.06) * projectileDt; // slight gravity on projectiles
    proj.life -= projectileDt;
    // collide with world bounds
    if(proj.x < 0 || proj.x > world.width || proj.y > world.height + 800) proj.life = 0;
    // collision with player (hostile)
    if(proj.hostile && proj.life > 0 && player.invulnerable <= 0){
      const pb = {x: proj.x - proj.r, y: proj.y - proj.r, w: proj.r*2, h: proj.r*2};
      if(rectsOverlap(pb, pbox)){
        // harmful projectile: reduce one life, give brief invulnerability and knockback.
        player.lives = Math.max(0, player.lives - 1);
        playLose();
        floatingAmmoTexts.push({x: player.x, y: player.y - 20, t: 1.2, text: '-1 VIE'});
        player.invulnerable = 1.2;
        player.vy = -JUMP_V * 0.4;
        // small horizontal nudge away from projectile source
        player.x += (proj.x > player.x ? -48 : 48);
        // only trigger game over when lives reach zero (menu/gameover handled elsewhere)
        if(player.lives <= 0){
          window.gameState = 'gameover';
        }
        proj.life = 0;
      }
    }
    // collision with enemies (player projectile)
    if(!proj.hostile && proj.life > 0){
      for(const e of world.enemies){
        if(e.dead) continue;
        if(e.type === 'saw' || e.type === 'spike_head' || e.type === 'fire') continue;
        const eb = {x: e.x, y: e.y, w: e.w, h: e.h};
        const pb = {x: proj.x - proj.r, y: proj.y - proj.r, w: proj.r*2, h: proj.r*2};
        if(rectsOverlap(pb, eb)){
          // apply damage
          const dmg = proj.damage || 120;
          if(e.boss){
            // En mode libre, le boss prend des dégâts classiques sans quiz
            if (window.gameMode === 'free') {
              e.hp = Math.max(0, e.hp - dmg);
              if(e.hp <= 0){
                e.dead = true;
                score += 2000;
                // Chance to gain time
                if (Math.random() < 0.35 && typeof window.levelTimer === 'number') {
                  window.levelTimer += 5 + Math.floor(Math.random() * 6);
                  // Spawn a floating text for time
                  floatingAmmoTexts.push({x: e.x + e.w/2, y: e.y - 40, text: "+Temps!", life: 1});
                }
                world.coins.push({x: e.x + e.w/2, y: e.y - 24, r: 10, collected:false, isAmmo: true, ammo: 10});
              }
            } else {
              // ── Boss-Quiz Mechanic (Leçon / Eval) ──
              if(!isQuizActive() && !e._quizPending){
                e._quizPending = true;
                triggerQuiz(e, (wasCorrect) => {
                  e._quizPending = false;
                if(wasCorrect) {
                  // Bonne réponse : gros dégâts au boss
                  e.hp = Math.max(0, e.hp - dmg * 8); // x8 damage so it's ~3 questions to kill a boss
                  if(e.hp <= 0){
                    e.dead = true;
                    score += 2000;
                    // Always gain some time on quiz boss kill
                    if (typeof window.levelTimer === 'number') {
                      window.levelTimer += 10 + Math.floor(Math.random() * 6);
                      floatingAmmoTexts.push({x: e.x + e.w/2, y: e.y - 40, text: "+Temps!", life: 1});
                    }
                    const ammoGain = 8 + Math.floor(Math.random()*8);
                    world.coins.push({x: e.x + e.w/2, y: e.y - 24, r: 10, collected:false, isAmmo: true, ammo: ammoGain});
                  }
                } else {
                  // Mauvaise réponse : en mode leçon on ne perd pas de vie !
                  if (window.gameMode !== 'lesson' && !window.consumeAnswerShield?.()) {
                    player.lives = Math.max(0, player.lives - 1);
                    playLose();
                    floatingAmmoTexts.push({x: player.x, y: player.y - 20, t: 1.2, text: '-1 VIE'});
                  }
                  player.invulnerable = 1.2;
                  player.vy = -JUMP_V * 0.4;
                  if(player.lives <= 0) window.gameState = 'gameover';
                }
              });
            }
          }
        } else {
            e.dead = true;
            score += 150;
            // small ammo drop chance on enemy kill
            if(Math.random() < 0.6){
              const ammoGain = 1 + Math.floor(Math.random()*3);
              world.coins.push({x: e.x + e.w/2, y: e.y - 12, r: 10, collected:false, ammo: ammoGain});
              // spawn floating text to show ammo pickup (will be shown when collected)
            }
          }
          proj.life = 0;
          break;
        }
      }
    }
  }
  world.projectiles = world.projectiles.filter(p=>p.life > 0);

  // coins and ammo pickups (coins array used for all visual pickups)
  for(const c of world.coins){
    if(!c.collected && timedEffectActive('coinMagnetUntil') && !c.isHeart && !c.isAmmo && !c.ammo){
      const cx = c.x;
      const cy = c.y;
      const px = player.x + player.w / 2;
      const py = player.y + player.h / 2;
      const dist = Math.hypot(px - cx, py - cy);
      if (dist < 220) {
        c.x += ((px - cx) / Math.max(1, dist)) * 520 * dt;
        c.y += ((py - cy) / Math.max(1, dist)) * 520 * dt;
      }
    }
    const pickupRadius = timedEffectActive('coinMagnetUntil') && !c.isHeart && !c.isAmmo && !c.ammo ? 34 : c.r;
    if(!c.collected && rectsOverlap({x: c.x - pickupRadius, y: c.y - pickupRadius, w: pickupRadius*2, h: pickupRadius*2}, pbox)){
      c.collected = true;
      player.collectTimer = 0.5; // Trigger player collect animation
      playCollect();
      
      if(c.isHeart){
        // Heart: +1 life (up to 5 max for balance)
        player.lives = Math.min(5, (player.lives || 0) + 1);
        floatingAmmoTexts.push({x: player.x, y: player.y - 20, t: 1.2, text: '+1 VIE'});
      } else if(c.isAmmo || c.ammo){
        // Ammo: +n bullets
        const gained = c.ammo || (1 + Math.floor(Math.random()*3));
        player.ammo = (player.ammo || 0) + gained;
        floatingAmmoTexts.push({x: player.x, y: player.y - 20, t: 1.2, text: '+' + gained + ' BALLES'});
      } else {
        // Normal Coin: +100 score & +1 coin
        const coinGain = timedEffectActive('coinMultiplierUntil') ? 2 : 1;
        score += 100;
        player.coins = (player.coins || 0) + coinGain;
        floatingAmmoTexts.push({x: player.x, y: player.y - 20, t: 1.2, text: `+${coinGain} 🪙`});
      }
    }
  }

  // Lesson nodes (livres) updates and collisions
  if (world.livres) {
    for (const livre of world.livres) {
      if (livre.collected) continue;
      
      let unlock = false;

      if (!livre.type || livre.type === 'livre') {
        if (rectsOverlap({x: livre.x - livre.r, y: livre.y - livre.r, w: livre.r*2, h: livre.r*2}, pbox)) {
          unlock = true;
        }
      } else if (livre.type === 'fragments') {
        let allCollected = true;
        for (const frag of livre.fragments) {
          if (!frag.collected) {
             if (rectsOverlap({x: frag.x - 16, y: frag.y - 16, w: 32, h: 32}, pbox)) {
               frag.collected = true;
               floatingAmmoTexts.push({x: frag.x, y: frag.y - 20, t: 1.0, text: '🧩 Fragment !'});
               playCollect();
             } else {
               allCollected = false;
             }
          }
        }
        if (allCollected) unlock = true;
      } else if (livre.type === 'crystal') {
        const dist = Math.hypot(player.x + player.w/2 - livre.x, player.y + player.h/2 - livre.y);
        if (dist < 160) {
          livre.progress = (livre.progress || 0) + dt;
          if (livre.progress >= 2.0) {
            unlock = true;
          }
        } else {
          livre.progress = Math.max(0, (livre.progress || 0) - dt * 0.5);
        }
      } else if (livre.type === 'switch_door') {
        if (!livre.doorOpen && rectsOverlap({x: livre.x - 24, y: livre.y - 20, w: 48, h: 40}, pbox)) {
           livre.doorOpen = true;
           floatingAmmoTexts.push({x: livre.x, y: livre.y - 20, t: 1.0, text: '🚪 Ouvert !'});
           playCollect();
        }
        if (livre.doorOpen && rectsOverlap({x: livre.doorX - 48, y: livre.doorY - 96, w: 96, h: 192}, pbox)) {
           unlock = true;
        }
      } else if (livre.type === 'npc') {
        if (rectsOverlap({x: livre.x - 48, y: livre.y - 64, w: 96, h: 128}, pbox)) {
           unlock = true;
        }
      } else if (livre.type === 'mirror') {
        const dist = Math.hypot(player.x + player.w/2 - livre.x, player.y + player.h/2 - livre.y);
        if (dist < 180 && player._jumpCount >= 2) {
           unlock = true;
        }
      }

      if (unlock) {
        livre.collected = true;
        floatingAmmoTexts.push({x: player.x, y: player.y - 20, t: 1.4, text: '📖 SAVOIR DÉBLOQUÉ !'});
        window.dispatchEvent(new CustomEvent('livre-collected', {
          detail: { x: player.x, y: player.y }
        }));
      }
    }
  }

  // update floating ammo texts
  for(const t of floatingAmmoTexts){
    t.t -= dt;
  }
  floatingAmmoTexts = floatingAmmoTexts.filter(t=>t.t > 0);
  window.floatingAmmoTexts = floatingAmmoTexts;

  if(player.invulnerable > 0) player.invulnerable -= dt;
  if(player.collectTimer > 0) player.collectTimer -= dt;



  // update score for render
  window.__scoreForRender = score;

  // draw (render module)
  draw();

  // update prev jump state for next frame (rising-edge detection)
  _prevJumpPressed = !!input.jump;

  requestAnimationFrame(loop);
}

// Tombstones for removed functions (kept as markers for refactor)
// removed function update() {}
// removed function resetGame() {}
// removed function respawnBrief() {}
// removed function respawn() {}
