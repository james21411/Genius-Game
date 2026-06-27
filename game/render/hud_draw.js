/*
Focused module: HUD drawing (ammo, score, lives, helper shapes)
*/
import { assetsReady, assets } from '../assets.js';

export function makeHudDraw({ ctx, assetsReady, assets, world, player, getCanvasSize }){
  // helper: rounded rect (exposed only to this module)
  function roundRect(ctx, x, y, w, h, r, fill, stroke){
    if(typeof r === 'undefined') r = 5;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if(fill){
      ctx.fill();
    }
    if(stroke){
      ctx.stroke();
    }
  }

  function drawFlameIcon(ctx, cx, cy, fr){
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255,140,30,0.14)';
    ctx.shadowBlur = 12;
    ctx.shadowColor = 'rgba(255,120,30,0.9)';
    ctx.arc(cx, cy, fr*1.6, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 1.05);
    ctx.beginPath();
    ctx.moveTo(0, -fr*1.05);
    ctx.quadraticCurveTo(fr*0.6, -fr*0.15, fr*0.2, fr*0.8);
    ctx.quadraticCurveTo(0, fr*0.5, -fr*0.2, fr*0.8);
    ctx.quadraticCurveTo(-fr*0.6, -fr*0.15, 0, -fr*1.05);
    ctx.closePath();
    const fg = ctx.createLinearGradient(0, -fr*1.05, 0, fr*0.9);
    fg.addColorStop(0, '#fff6b8');
    fg.addColorStop(0.45, '#ffd188');
    fg.addColorStop(1, '#ff6f3a');
    ctx.fillStyle = fg;
    ctx.fill();
    ctx.restore();
  }

  function drawAmmoAndHUD(camX, camY, useTextures){
    const { vw } = getCanvasSize();
    const ammoX = 14;
    const ammoY = 14;
    const scoreValue = Math.max(0, typeof window.__scoreForRender === 'number' ? window.__scoreForRender : 0);
    const livesValue = Math.max(0, player.lives || 0);

    // 1. Draw Ammo box on the top-left
    ctx.save();
    const ammoBoxW = 140;
    
    // Draw Level Timer (Top Right, left of Pause button)
    if (typeof window.levelTimer === 'number') {
      const minutes = Math.floor(window.levelTimer / 60);
      const seconds = Math.floor(window.levelTimer % 60).toString().padStart(2, '0');
      ctx.font = "bold 20px 'Press Start 2P', 'VT323', monospace";
      ctx.fillStyle = window.levelTimer < 60 ? "#e74c3c" : "#f5c04a"; // Red if < 1 min, else Yellow
      ctx.textAlign = "right";
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.fillText(`⏱ ${minutes}:${seconds}`, vw - 75, 42);
    }
    const ammoBoxH = 44;
    ctx.fillStyle = 'rgba(10, 20, 30, 0.75)';
    ctx.strokeStyle = '#f5c04a'; // gold/yellow border to match game style
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 6;
    roundRect(ctx, ammoX, ammoY, ammoBoxW, ammoBoxH, 10, true, true);
    ctx.shadowBlur = 0; // reset shadow

    // Ammo icon
    const iconSize = 28;
    const iconX = ammoX + 10;
    const iconY = ammoY + (ammoBoxH - iconSize) / 2;
    if(assets.projectilePlayer && assets.projectilePlayer.width){
      ctx.drawImage(assets.projectilePlayer, 0, 0, assets.projectilePlayer.width, assets.projectilePlayer.height, iconX, iconY, iconSize, iconSize);
    } else {
      drawFlameIcon(ctx, iconX + iconSize/2, iconY + iconSize/2, 9);
    }

    // Ammo text (beautiful color & retro font with spacing)
    ctx.fillStyle = '#ffd188'; // Warm orange-gold
    ctx.font = 'bold 22px "VT323", "Press Start 2P", monospace';
    ctx.letterSpacing = '2px';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${player.ammo || 0}`, iconX + iconSize + 12, ammoY + ammoBoxH / 2 + 1);
    ctx.restore();

    // 1b. Draw Coins box on the top-left (below Ammo Box)
    ctx.save();
    const coinBoxX = 14;
    const coinBoxY = 66;
    const coinBoxW = 140;
    const coinBoxH = 44;
    ctx.fillStyle = 'rgba(10, 20, 30, 0.75)';
    ctx.strokeStyle = '#ffd700'; // Gold border for coins
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 6;
    roundRect(ctx, coinBoxX, coinBoxY, coinBoxW, coinBoxH, 10, true, true);
    ctx.shadowBlur = 0; // reset shadow

    // Coin icon
    const coinIconSize = 24;
    const coinIconX = coinBoxX + 12;
    const coinIconY = coinBoxY + (coinBoxH - coinIconSize) / 2;
    if(assets.coin && assets.coin.width){
      ctx.drawImage(assets.coin, 0, 0, assets.coin.width, assets.coin.height, coinIconX, coinIconY, coinIconSize, coinIconSize);
    } else {
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(coinIconX + coinIconSize/2, coinIconY + coinIconSize/2, 10, 0, Math.PI*2);
      ctx.fill();
    }

    // Coin text (beautiful color & retro font with spacing)
    ctx.fillStyle = '#ffd700'; // Gold color
    ctx.font = 'bold 22px "VT323", "Press Start 2P", monospace';
    ctx.letterSpacing = '2px';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${player.coins || 0}`, coinIconX + coinIconSize + 14, coinBoxY + coinBoxH / 2 + 1);
    ctx.restore();

    // 2. Draw Floating ammo/life pick-up texts (beautiful color & retro font with spacing)
    if(window.floatingAmmoTexts){
      ctx.save();
      ctx.font = 'bold 20px "VT323", "Press Start 2P", sans-serif';
      ctx.letterSpacing = '2px';
      for(const ft of window.floatingAmmoTexts || []){
        const alpha = Math.max(0, Math.min(1, ft.t));
        if (ft.text.startsWith('-')) {
            ctx.fillStyle = `rgba(255, 80, 80, ${alpha})`;
        } else {
            ctx.fillStyle = `rgba(255, 230, 100, ${alpha})`;
        }
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.fillText(ft.text, Math.round(ft.x - camX), Math.round(ft.y - camY - (1-ft.t)*30));
      }
      ctx.restore();
    }

    // 3. Draw Centered Hearts
    const heartSize = 28;
    const heartGap = 12;
    const heartsCount = Math.max(0, player.lives);
    const totalWidth = heartsCount * heartSize + Math.max(0, heartsCount - 1) * heartGap;
    const heartStartX = Math.round(vw/2 - totalWidth/2);
    const heartY = 18;

    for(let i = 0; i < heartsCount; i++){
      const hx = heartStartX + i*(heartSize + heartGap);
      ctx.save();
      ctx.translate(hx, heartY);
      
      // Shadow for hearts
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;

      ctx.beginPath();
      ctx.moveTo(heartSize/2, heartSize/1.2);
      ctx.bezierCurveTo(heartSize/2 + 8, heartSize/1.6, heartSize + 2, heartSize/3, heartSize/2, heartSize/6);
      ctx.bezierCurveTo(0 - 2, heartSize/3, heartSize/2 - 8, heartSize/1.6, heartSize/2, heartSize/1.2);
      ctx.closePath();
      ctx.fillStyle = '#e84b4b';
      ctx.fill();
      ctx.restore();
    }

    // 4. Draw Numeric Life Points just below the hearts (using Press Start 2P with vertical spacing & letterSpacing)
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;

    ctx.font = 'bold 16px "Press Start 2P", monospace';
    ctx.letterSpacing = '3px';
    ctx.fillStyle = '#ff6b6b'; // Light coral red
    ctx.fillText(`${livesValue} PV`, Math.round(vw/2), heartY + heartSize + 12);

    // 5. Draw XP/Score below the life points (using VT323 with spacing)
    ctx.font = 'bold 26px "VT323", monospace';
    ctx.letterSpacing = '4px';
    ctx.fillStyle = '#ffd700'; // Pure gold
    ctx.fillText(`${scoreValue} XP`, Math.round(vw/2), heartY + heartSize + 36);
    ctx.restore();
  }

  return {
    drawAmmoAndHUD
  };
}

/*
Tombstones:
// removed world/enemy/player draw code (moved to smaller modules)
*/