/*
Focused module: world drawing (sky, banners, platforms, coins, enemies, overlay)
*/
import { assetsReady, assets } from '../assets.js';

export function makeWorldDraw({ ctx, assetsReady, assets, world, player, getCanvasSize }){
  function drawSky(vw, vh){
    const skyGrad = ctx.createLinearGradient(0, 0, 0, vh);
    skyGrad.addColorStop(0, '#8fcfff');
    skyGrad.addColorStop(1, '#6bb3e6');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, vw, vh);
  }

  function drawOverlay(vw, vh){
    if(window.gameState === 'menu'){
      if(assets.menu && assets.menu.width){
        const targetW = Math.min(vw * 0.9, assets.menu.width);
        const targetH = Math.min(vh * 0.7, assets.menu.height * (targetW / assets.menu.width));
        const dx = Math.round((vw - targetW)/2);
        const dy = Math.round((vh - targetH)/2 - 20);
        ctx.globalAlpha = 0.98;
        ctx.drawImage(assets.menu, 0,0,assets.menu.width, assets.menu.height, dx, dy, targetW, targetH);
        ctx.globalAlpha = 1;
        // overlay a clear start hint over the artwork
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(dx + 20, dy + targetH - 96, targetW - 40, 64);
        ctx.fillStyle = '#f5d68a';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 6;
        ctx.font = `${Math.max(18, Math.floor(targetH*0.06))}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CLIQUEZ POUR DEMARRER', dx + targetW/2, dy + targetH - 64 + 32);
        ctx.restore();
      } else {
        // draw a solid contrasted panel and render textured-ish text so it's visible on all backgrounds
        ctx.fillStyle = 'rgba(8,8,8,0.78)';
        ctx.fillRect(20,20,vw-40, vh-40);

        // large pixel-like title
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Title: strong stroke + fill for high contrast
        ctx.font = '42px monospace';
        ctx.lineWidth = 6;
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.strokeText('Genius Jump', Math.round(vw/2), 80);
        ctx.fillStyle = '#ffd97a';
        ctx.fillText('Genius Jump', Math.round(vw/2), 80);

        // Debug info position
        ctx.font = '12px monospace';
        ctx.fillStyle = '#aaa';
        ctx.fillText(`Debug: Rotation Active (State: ${window.gameState})`, vw - 150, 20);

        // Start hint (smaller)
        ctx.font = '20px monospace';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.strokeText('Cliquez pour démarrer', Math.round(vw/2), vh - 60);
        ctx.fillStyle = '#e6f7d9';
        ctx.fillText('Cliquez pour démarrer', Math.round(vw/2), vh - 60);
        ctx.restore();
      }
    } else if(window.gameState === 'gameover'){
      if(assets.gameover && assets.gameover.width){
        const targetW = Math.min(vw * 0.9, assets.gameover.width);
        const targetH = Math.min(vh * 0.7, assets.gameover.height * (targetW / assets.gameover.width));
        const dx = Math.round((vw - targetW)/2);
        const dy = Math.round((vh - targetH)/2 - 20);
        ctx.globalAlpha = 0.98;
        ctx.drawImage(assets.gameover, 0,0,assets.gameover.width, assets.gameover.height, dx, dy, targetW, targetH);
        ctx.globalAlpha = 1;

        // overlay clear restart hint
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(dx + 20, dy + targetH - 96, targetW - 40, 64);
        ctx.fillStyle = '#ffd6d6';
        ctx.font = `${Math.max(18, Math.floor(targetH*0.05))}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GAME OVER - CLIQUEZ POUR RECOMMENCER', dx + targetW/2, dy + targetH - 64 + 32);
        ctx.restore();
      } else {
        // dark backdrop
        ctx.fillStyle = 'rgba(0,0,0,0.9)';
        ctx.fillRect(0,0,vw,vh);

        // high-contrast, textured-like numeric rendering for score if digits texture available
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // big GAME OVER title
        ctx.font = '48px monospace';
        ctx.lineWidth = 8;
        ctx.strokeStyle = 'rgba(0,0,0,0.95)';
        ctx.strokeText('GAME OVER', Math.round(vw/2), Math.round(vh/2) - 40);
        ctx.fillStyle = '#ffb3b3';
        ctx.fillText('GAME OVER', Math.round(vw/2), Math.round(vh/2) - 40);

        // attempt to draw numeric score using digits texture if present
        const scoreValue = Math.max(0, typeof window.__scoreForRender === 'number' ? window.__scoreForRender : 0);
        function drawNumberString(str, tx, ty, targetH = 40, spacing = 6){
          if(!(assets.digits && assets.digits.width && assets.digits.height)) return false;
          const srcDigitW = Math.floor(assets.digits.width / 10);
          const srcDigitH = assets.digits.height;
          const targetW = Math.floor(targetH * (srcDigitW / srcDigitH));
          let dx = tx - (str.length * (targetW + spacing))/2;
          for(const ch of str){
            const n = Math.max(0, Math.min(9, parseInt(ch) || 0));
            ctx.drawImage(assets.digits, n*srcDigitW, 0, srcDigitW, srcDigitH, dx, ty - targetH/2, targetW, targetH);
            dx += targetW + spacing;
          }
          return true;
        }

        const didDraw = drawNumberString(String(scoreValue), Math.round(vw/2), Math.round(vh/2) + 30, 48, 8);
        if(!didDraw){
          // fallback text
          ctx.font = '22px monospace';
          ctx.fillStyle = '#ffdede';
          ctx.fillText('Score: ' + String(scoreValue), Math.round(vw/2), Math.round(vh/2) + 30);
        }

        // restart hint
        ctx.font = '18px monospace';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.strokeText('Cliquez pour recommencer', Math.round(vw/2), Math.round(vh/2) + 86);
        ctx.fillStyle = '#f0f7d8';
        ctx.fillText('Cliquez pour recommencer', Math.round(vw/2), Math.round(vh/2) + 86);
        ctx.restore();
      }
    }
  }

  function drawBanners(camX, vw, vh){
    if(assetsReady() && assets.banners && assets.banners.length){
      const villages = Math.max(1, world.bannerMap.length);
      const segW = world.generatedTo > 0 ? (world.generatedTo / villages) : Math.max(800, Math.floor(world.width / 40));
      const startSeg = Math.floor(camX / segW);
      const endSeg = Math.ceil((camX + vw) / segW);
      for(let s = Math.max(0, startSeg - 1); s <= Math.min(villages - 1, endSeg + 1); s++){
        const bx = Math.round(s * segW - camX);
        const themeIndex = (world.bannerMap && typeof world.bannerMap[s] === 'number') ? world.bannerMap[s] : Math.floor(Math.random() * assets.banners.length);
        const img = assets.banners[themeIndex];
        if(img && img.width){
          const bh = Math.round(vh * 0.82);
          const drawY = 0;
          const drawX = bx - 2;
          const drawW = Math.round(segW + 4);
          ctx.drawImage(img, 0, 0, img.width, img.height, drawX, drawY, drawW, bh);

          const seamW = Math.min(48, Math.max(12, Math.round(vw * 0.01)));
          const tex = (assets.platformVariants && assets.platformVariants[0]) ? assets.platformVariants[0] : null;
          if(tex && tex.width){
            const sx = drawX + drawW - seamW/2;
            for(let tx = 0; tx < seamW; tx += tex.width){
              const dw = Math.min(tex.width, seamW - tx);
              ctx.drawImage(tex, 0, 0, tex.width, tex.height, sx + tx, drawY, dw, bh);
            }
            const lx = drawX - seamW/2;
            for(let tx = 0; tx < seamW; tx += tex.width){
              const dw = Math.min(tex.width, seamW - tx);
              ctx.drawImage(tex, 0, 0, tex.width, tex.height, lx + tx, drawY, dw, bh);
            }
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            ctx.fillRect(drawX - seamW/2, drawY, seamW, bh);
            ctx.fillRect(drawX + drawW - seamW/2, drawY, seamW, bh);
          } else {
            const fadeW = Math.min(24, Math.round(vw * 0.01));
            if(fadeW > 0){
              const lg = ctx.createLinearGradient(drawX,0,drawX+fadeW,0);
              lg.addColorStop(0, 'rgba(255,255,255,0.0)');
              lg.addColorStop(1, 'rgba(255,255,255,0.08)');
              ctx.fillStyle = lg;
              ctx.fillRect(drawX, drawY, fadeW, bh);
              const rg = ctx.createLinearGradient(drawX+drawW-fadeW,0,drawX+drawW,0);
              rg.addColorStop(0, 'rgba(255,255,255,0.08)');
              rg.addColorStop(1, 'rgba(255,255,255,0.0)');
              ctx.fillStyle = rg;
              ctx.fillRect(drawX+drawW-fadeW, drawY, fadeW, bh);
            }
          }
        } else {
          ctx.fillStyle = `rgba(${30 + (s%10)*10}, ${60 + (s%10)*8}, ${30 + (s%10)*6}, 0.18)`;
          ctx.fillRect(bx, 0, Math.round(segW), Math.round(vh*0.82));
        }
      }
    } else {
      ctx.fillStyle = 'rgba(15,70,30,0.32)';
      ctx.fillRect(0, vh*0.6, getCanvasSize().vw, vh*0.4);
    }
  }

  function drawPlatforms(camX, camY, useTextures){
    for(const plat of world.platforms){
      const x = Math.round(plat.x - camX);
      const y = Math.round(plat.y - camY);
      const wplat = plat.w;
      const hplat = plat.h;
      const theme = plat.theme || 0;
        if(plat.type === 'quiz_platform') {
          ctx.fillStyle = '#f5c04a'; // Gold
          ctx.fillRect(x, y, wplat, hplat);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 20px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('?', x + wplat/2, y + hplat/2 + 6);
          
          // ── Mini-tutoriel ──
          if(plat.isTutorial && !plat._quizTriggered){
            const bob = Math.sin(performance.now()/200)*5;
            ctx.font = 'bold 16px sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#000';
            ctx.fillText('Saute ici pour', x + wplat/2, y - 40 + bob);
            ctx.fillText('répondre au quiz !', x + wplat/2, y - 20 + bob);
            ctx.shadowBlur = 0;
          }
        } else if(useTextures){
          const variants = assets.platformVariants.length ? assets.platformVariants : [null];
          const tex = variants[theme % variants.length] || assets.platformVariants[0];
          if(tex && tex.width){
            const tileW = Math.max(32, tex.width);
            for(let tx = 0; tx < wplat; tx += tileW){
              const drawW = Math.min(tileW, wplat - tx);
              ctx.drawImage(tex, 0, 0, tex.width, tex.height, x + tx, y, drawW, hplat + 8);
            }
          } else {
            ctx.fillStyle = '#776655';
            ctx.fillRect(x, y, wplat, hplat);
          }
          if(plat.type === 'goal'){
            ctx.drawImage(assets.coin, x + wplat/2 - 24, y - 64, 48, 64);
          }
        } else {
          ctx.fillStyle = plat.type === 'goal' ? '#b5e061' : '#5f6b7a';
          ctx.fillRect(x, y, wplat, hplat);
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          ctx.fillRect(x, y, wplat, 6);
        }
    }
  }

  function drawCoins(camX, camY, useTextures){
    for(const c of world.coins){
      if(c.collected) continue;
      const cx = Math.round(c.x - camX);
      const cy = Math.round(c.y - camY);
      
      if(c.isHeart){
        // Draw Heart
        ctx.save();
        ctx.translate(cx - 12, cy - 12);
        const heartSize = 24;
        ctx.beginPath();
        ctx.moveTo(heartSize/2, heartSize/1.2);
        ctx.bezierCurveTo(heartSize/2 + 8, heartSize/1.6, heartSize + 2, heartSize/3, heartSize/2, heartSize/6);
        ctx.bezierCurveTo(0 - 2, heartSize/3, heartSize/2 - 8, heartSize/1.6, heartSize/2, heartSize/1.2);
        ctx.closePath();
        ctx.fillStyle = '#ff4b4b';
        ctx.fill();
        ctx.restore();
      } else if(c.isAmmo){
        // Draw Ammo Box
        ctx.fillStyle = '#e67e22';
        ctx.fillRect(cx - 10, cy - 10, 20, 20);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 10, cy - 10, 20, 20);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('A', cx, cy + 5);
      } else if(useTextures){
        ctx.drawImage(assets.coin, cx - 12, cy - 12, 24, 24);
      } else {
        ctx.beginPath();
        ctx.fillStyle = '#ffd66b';
        ctx.arc(cx, cy, c.r, 0, Math.PI*2);
        ctx.fill();
      }
    }
  }

  function drawEnemies(camX, camY, useTextures){
    const now = performance.now();
    for(const e of world.enemies){
      const bob = (e.flying ? Math.sin((now/300) + e.x*0.01) * 8 : Math.sin((now/400) + e.x*0.01) * 3);
      const wobble = Math.cos((now/220) + e.x*0.02) * 2;
      const ex = Math.round(e.x - camX + wobble);
      const ey = Math.round(e.y - camY + bob);
      if(useTextures){
        if(e.boss){
          const bw = e.w || 160, bh = e.h || 160;
          const bossDrawY = ey + 40;
          
          // ── Boss-Quiz Visual Indicator ──
          ctx.save();
          ctx.beginPath();
          ctx.arc(ex + bw/2, bossDrawY + bh/2, bw/2 + 20 + Math.sin(now/150)*10, 0, Math.PI*2);
          ctx.fillStyle = 'rgba(155, 89, 182, 0.3)'; // purple aura
          ctx.fill();
          ctx.strokeStyle = '#9b59b6';
          ctx.lineWidth = 3;
          ctx.stroke();
          
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 36px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('❓', ex + bw/2, bossDrawY - 10 + bob);
          ctx.restore();

          const bi = Math.min(Math.max(parseInt((e.type||'').replace('boss',''))-1,0), assets.bosses.length-1);
          const img = assets.bosses[bi] || assets.enemy;
          if(img && img.width){
            ctx.save();
            const bossDrawY = ey + 40;
            if(e.dir < 0){
              ctx.translate(ex + bw, 0);
              ctx.scale(-1,1);
              ctx.drawImage(img, 0,0,img.width,img.height, 0, bossDrawY, bw, bh);
            } else {
              ctx.drawImage(img, 0,0,img.width,img.height, ex, bossDrawY, bw, bh);
            }
            ctx.restore();
          } else {
            ctx.fillStyle = '#6b2f2f';
            ctx.fillRect(ex, ey + 40, bw, bh);
          }
          const barW = Math.min(420, Math.max(220, Math.floor(bw*1.9)));
          const bx = Math.round(ex + bw/2 - barW/2);
          const by = ey + 40 - 22;
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(bx, by, barW, 14);
          ctx.fillStyle = '#b94b42';
          const hpRatio = (e.hp || 0) / (e.maxHp || 1);
          ctx.fillRect(bx+2, by+2, Math.max(2, Math.round((barW-4) * hpRatio)), 10);
        } else {
          const ew = e.w || 40, eh = e.h || 48;
          let img = null;
          if(e.type && e.type === 'beast' && assets.enemyWalk.length){
            img = assets.enemyWalk[0];
          } else if(e.type && e.type.startsWith('walk') && assets.enemyWalk.length){
            img = assets.enemyWalk[Math.min(assets.enemyWalk.length-1, 0)];
          } else if(e.type && e.type.startsWith('fly') && assets.enemyFly.length){
            const map = { fly1:0, fly2:1, fly3:2 };
            const idx = Math.min(assets.enemyFly.length-1, map[e.type] || 0);
            img = assets.enemyFly[idx];
          } else {
            img = assets.enemy;
          }
          if(img && img.width){
            ctx.save();
            if(e.dir < 0){
              ctx.translate(ex + ew, 0);
              ctx.scale(-1,1);
              ctx.drawImage(img, 0, 0, img.width, img.height, 0, ey, ew, eh);
            } else {
              ctx.drawImage(img, 0, 0, img.width, img.height, ex, ey, ew, eh);
            }
            ctx.restore();
          } else {
            ctx.fillStyle = e.flying ? '#f0c86b' : '#b94b42';
            ctx.fillRect(ex, ey, ew, eh);
          }
        }
      } else {
        ctx.fillStyle = e.flying ? '#f0c86b' : '#b94b42';
        ctx.fillRect(ex, ey, e.w, e.h);
      }
    }
  }

  return {
    drawSky,
    drawBanners,
    drawPlatforms,
    drawCoins,
    drawEnemies,
    drawOverlay
  };
}

/*
Tombstones:
// removed projectiles drawing
// removed player drawing
// removed HUD drawing
*/