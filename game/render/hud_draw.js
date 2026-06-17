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
    const ammoDigits = String(player.ammo || 0);
    const scoreValue = Math.max(0, typeof window.__scoreForRender === 'number' ? window.__scoreForRender : 0);
    const livesValue = Math.max(0, player.lives || 0);

    function drawNumberString(str, tx, ty, targetH = 40, spacing = 6){
      if(!(assets.digits && assets.digits.width && assets.digits.height)) return;
      const srcDigitW = Math.floor(assets.digits.width / 10);
      const srcDigitH = assets.digits.height;
      const targetW = Math.floor(targetH * (srcDigitW / srcDigitH));
      let dx = tx;
      for(const ch of str){
        const n = Math.max(0, Math.min(9, parseInt(ch) || 0));
        ctx.drawImage(assets.digits, n*srcDigitW, 0, srcDigitW, srcDigitH, dx, ty, targetW, targetH);
        dx += targetW + spacing;
      }
      return dx - tx;
    }

    const ammoH = 48;
    const ammoWdraw = drawNumberString(ammoDigits, ammoX + 6, ammoY, ammoH, 6);
    const iconSize = 40;
    const fx = ammoX + 12 + ammoWdraw;
    const fy = ammoY + 4;
    if(assets.projectilePlayer && assets.projectilePlayer.width){
      ctx.drawImage(assets.projectilePlayer, 0, 0, assets.projectilePlayer.width, assets.projectilePlayer.height, fx, fy, iconSize, iconSize);
    } else {
      drawFlameIcon(ctx, fx + iconSize/2, fy + iconSize/2, 12);
    }

    if(typeof floatingAmmoTexts !== 'undefined'){
      ctx.font = '18px sans-serif';
      for(const ft of floatingAmmoTexts || []){
        const alpha = Math.max(0, Math.min(1, ft.t));
        ctx.fillStyle = `rgba(255,240,180,${alpha})`;
        ctx.fillText(ft.text, Math.round(ft.x - camX), Math.round(ft.y - camY - (1-ft.t)*30));
      }
    }

    // Draw centered hearts (avoid top-right pause button area)
    const heartSize = 28; // increased size
    const heartGap = 12;
    const heartsCount = Math.max(0, player.lives);
    const totalWidth = heartsCount * heartSize + Math.max(0, heartsCount - 1) * heartGap;
    const heartStartX = Math.round(vw/2 - totalWidth/2);
    const heartY = 18; // top offset (keeps them away from the pause button on the right)

    for(let i = 0; i < heartsCount; i++){
      const hx = heartStartX + i*(heartSize + heartGap);
      ctx.save();
      ctx.translate(hx, heartY);
      ctx.beginPath();
      ctx.moveTo(heartSize/2, heartSize/1.2);
      ctx.bezierCurveTo(heartSize/2 + 8, heartSize/1.6, heartSize + 2, heartSize/3, heartSize/2, heartSize/6);
      ctx.bezierCurveTo(0 - 2, heartSize/3, heartSize/2 - 8, heartSize/1.6, heartSize/2, heartSize/1.2);
      ctx.closePath();
      ctx.fillStyle = '#e84b4b';
      ctx.fill();
      ctx.restore();
    }

    // Score stays centered below the hearts
    const scoreStr = String(scoreValue);
    const scoreH = 36;
    const scoreX = Math.round(vw/2 - 40);
    const scoreY = 64; // moved down so it doesn't overlap hearts
    drawNumberString(scoreStr, scoreX, scoreY, scoreH, 4);

    // remove right-aligned 'V:' label and numeric lives rendering (hearts now represent lives)
  }

  return {
    drawAmmoAndHUD
  };
}

/*
Tombstones:
// removed world/enemy/player draw code (moved to smaller modules)
*/