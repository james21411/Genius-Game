/*
Focused module: entities drawing (player and projectiles)
*/
import { assetsReady, assets } from '../assets.js';
import { isQuizActive } from '../quiz_engine.js';

export function makeEntitiesDraw({ ctx, assetsReady, assets, world, player, getCanvasSize }){
  function isVisibleRect(x, y, w, h, margin = 120){
    const { vw, vh } = getCanvasSize();
    return x + w >= -margin && x <= vw + margin && y + h >= -margin && y <= vh + margin;
  }

  function drawProjectiles(camX, camY){
    if(!world.projectiles) return;
    for(const proj of world.projectiles){
      const px = Math.round(proj.x - camX);
      const py = Math.round(proj.y - camY);
      const r = Math.max(16, (proj.r || 8) * 4);
      if(!isVisibleRect(px - r, py - r, r * 2, r * 2)) continue;
      if(proj.hostile){
        ctx.beginPath();
        ctx.fillStyle = 'rgba(240,120,60,0.98)';
        ctx.shadowColor = 'rgba(240,120,60,0.9)';
        ctx.shadowBlur = 8;
        ctx.arc(px, py, Math.max(6, proj.r||8), 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255,210,150,0.6)';
        ctx.arc(px - 2, py - 2, Math.max(2, (proj.r||6)/3), 0, Math.PI*2);
        ctx.fill();
      } else {
        const sprite = assets.projectilePlayer;
        if(sprite && sprite.width){
          const size = Math.max(20, (proj.r || 8) * 3);
          ctx.save();
          ctx.beginPath();
          ctx.fillStyle = 'rgba(255,150,40,0.10)';
          ctx.shadowBlur = 14;
          ctx.shadowColor = 'rgba(255,130,30,0.85)';
          ctx.arc(px, py, size * 0.9, 0, Math.PI*2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.drawImage(sprite, 0, 0, sprite.width, sprite.height, Math.round(px - size/2), Math.round(py - size/2), size, size);
          ctx.restore();
        } else {
          const flameR = Math.max(6, proj.r || 8);
          ctx.beginPath();
          ctx.fillStyle = 'rgba(255,160,40,0.12)';
          ctx.shadowBlur = 18;
          ctx.shadowColor = 'rgba(255,150,40,0.9)';
          ctx.arc(px, py, flameR*1.8, 0, Math.PI*2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.save();
          ctx.translate(px, py);
          ctx.scale(1, 1.1);
          ctx.beginPath();
          ctx.moveTo(0, -flameR*1.1);
          ctx.quadraticCurveTo(flameR*0.8, -flameR*0.2, flameR*0.3, flameR*0.9);
          ctx.quadraticCurveTo(0, flameR*0.6, -flameR*0.3, flameR*0.9);
          ctx.quadraticCurveTo(-flameR*0.8, -flameR*0.2, 0, -flameR*1.1);
          ctx.closePath();
          const g = ctx.createLinearGradient(0, -flameR*1.1, 0, flameR*1.0);
          g.addColorStop(0, '#fff4a8');
          g.addColorStop(0.35, '#ffd160');
          g.addColorStop(1, '#ff6a2b');
          ctx.fillStyle = g;
          ctx.fill();
          ctx.restore();
          ctx.beginPath();
          ctx.fillStyle = 'rgba(255,240,160,0.9)';
          ctx.arc(px, py - flameR*0.45, Math.max(2, flameR*0.35), 0, Math.PI*2);
          ctx.fill();
          ctx.beginPath();
          ctx.fillStyle = 'rgba(255,200,120,0.72)';
          ctx.arc(px - 2, py - 2, Math.max(2, (proj.r||6)/3), 0, Math.PI*2);
          ctx.fill();
        }
      }
    }
  }

  function drawPlayer(camX, camY, useTextures){
    const now = performance.now();
    const px = Math.round(player.x - camX);
    const py = Math.round(player.y - camY);

    // Draw stable shadow under player
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(px + player.w/2, py + player.h + 4, player.w*0.6, 6, 0, 0, Math.PI*2);
    ctx.fill();

    if(useTextures && assets.player && assets.player.width){
      ctx.save();
      
      // Nearest neighbor pixelated filtering
      ctx.imageSmoothingEnabled = false;
      ctx.mozImageSmoothingEnabled = false;
      ctx.webkitImageSmoothingEnabled = false;
      ctx.msImageSmoothingEnabled = false;

      // 1. Détection de l'animation active
      let animName = 'idle';
      let row = 0;
      let frames = 6;
      let duration = 180; // ms par frame
      
      // Check if player is standing on the goal platform
      const underPlat = world.platforms && world.platforms.find(plat => 
        player.grounded && 
        player.x + player.w > plat.x && 
        player.x < plat.x + plat.w && 
        Math.abs((player.y + player.h) - plat.y) < 6
      );
      const isOnGoal = underPlat && underPlat.type === 'goal';

      if (isQuizActive()) {
        animName = 'idle'; // En cas de quiz, on affiche le repos statique
        row = 0;
        frames = 1;
        duration = 180;
      } else if (!player.grounded) {
        animName = 'jump';
        row = 2; // Utilise la ligne Run (sans livre) pour le saut
        frames = 3; // Seulement les 3 premières frames (sans livre)
        duration = 120;
      } else if (isOnGoal) {
        animName = 'victory';
        row = 4; // Ligne 4 : Victory
        frames = 6;
        duration = 120;
      } else if (player.collectTimer > 0) {
        animName = 'collect'; // Animation de collecte au sol
        row = 4; // Utilise la ligne 4 (Célébration / Collecte)
        frames = 4; // Limité aux frames 0, 1, 2, 3 (exclut 4 et 5 !)
        duration = 80;
      } else if (Math.abs(player.vx) > 250) {
        animName = 'run';
        row = 2; // Ligne 2 : Run
        frames = 6;
        duration = 60;
      } else if (Math.abs(player.vx) > 5) {
        animName = 'walk';
        row = 1; // Ligne 1 : Walk
        frames = 6;
        duration = 90;
      } else {
        animName = 'idle';
        row = 0; // Ligne 0 : Idle
        frames = 1; // Statique
        duration = 180;
      }

      // 2. Calcul de la frame courante
      let frameIdx = 0;
      if (animName === 'jump') {
        // Saut : on alterne les 3 premières frames de la ligne run pour un effet dynamique
        // (sans livre dans la main)
        const vy = player.vy;
        if (vy < -300) frameIdx = 0;      // Montée forte → frame 0
        else if (vy < 0) frameIdx = 1;   // Montée modérée → frame 1
        else frameIdx = 2;               // Descente → frame 2
      } else if (animName === 'collect') {
        // Collecte d'items : cycle sur les index 0, 1, 2, 5 (exclut les index 3 et 4, c-à-d les frames 4 et 5 en 1-indexed !)
        const totalTime = 4 * duration;
        const t = performance.now() % totalTime;
        const step = Math.floor(t / duration);
        const collectFrames = [0, 1, 2, 5];
        frameIdx = collectFrames[step];
      } else {
        const totalTime = frames * duration;
        const t = performance.now() % totalTime;
        frameIdx = Math.floor(t / duration);
      }

      // 3. Découpage exact basé sur les coordonnées pixel-art mesurées
      const FRAME_XS = [72, 230, 380, 530, 675, 820];
      const ROW_YS = [41, 254, 458, 667, 880];
      
      const sw = 125;
      const sh = 160;
      
      // Sécurité sur les indices
      const safeFrame = Math.min(Math.max(0, frameIdx), 5);
      const safeRow = Math.min(Math.max(0, row), 4);
      
      const sx = FRAME_XS[safeFrame];
      const sy = ROW_YS[safeRow];

      // Taille proportionnelle respectant le ratio du sprite original
      const drawW = 112;
      const drawH = 143;

      // 4. Point de pivot Bottom-Center
      const pivotX = px + player.w / 2;
      const pivotY = py + player.h;
      
      ctx.translate(pivotX, pivotY);

      // Inverser si le joueur regarde à gauche
      if(player.facing < 0){
        ctx.scale(-1, 1);
      }

      // Blink animation if player is invulnerable
      if (player.invulnerable > 0) {
        ctx.globalAlpha = Math.floor(performance.now() / 100) % 2 === 0 ? 0.3 : 1.0;
      }

      // Dessiner avec le pivot en bas au centre
      ctx.drawImage(
        assets.player,
        sx, sy, sw, sh,
        -drawW / 2, -drawH, drawW, drawH
      );
      
      // Reset alpha
      ctx.globalAlpha = 1.0;

      ctx.restore();
    } else {
      // Rendu de secours stable
      ctx.save();
      const pivotX = px + player.w / 2;
      const pivotY = py + player.h;
      ctx.translate(pivotX, pivotY);
      
      ctx.fillStyle = '#2ec4b6';
      ctx.fillRect(-player.w/2, -player.h, player.w, player.h);
      ctx.restore();
    }
  }

  return {
    drawProjectiles,
    drawPlayer
  };
}

/*
Tombstones:
// removed HUD drawing (moved to hud_draw)
// removed some combined draw helpers
*/
