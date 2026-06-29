/*
Focused module: world drawing (sky, banners, platforms, coins, enemies, overlay)
*/
import { assetsReady, assets } from '../assets.js';

const TERRAIN_TILE_W = 16;
const TERRAIN_TILE_H = 16;

let _terrainThemes = null;

function buildTerrainThemes() {
  if (_terrainThemes) return _terrainThemes;
  const sheet = assets.terrain_sheet;
  if (!sheet || !sheet.width) {
    _terrainThemes = [];
    return _terrainThemes;
  }

  const cols = Math.floor(sheet.width / TERRAIN_TILE_W);
  const rows = Math.floor(sheet.height / TERRAIN_TILE_H);
  const themes = [];

  try {
    const cvs = document.createElement('canvas');
    cvs.width = sheet.width;
    cvs.height = sheet.height;
    const c = cvs.getContext('2d');
    c.drawImage(sheet, 0, 0);
    const data = c.getImageData(0, 0, sheet.width, sheet.height).data;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        let visible = false;
        const px = col * TERRAIN_TILE_W;
        const py = row * TERRAIN_TILE_H;
        for (let y = 0; y < TERRAIN_TILE_H && !visible; y++) {
          for (let x = 0; x < TERRAIN_TILE_W && !visible; x++) {
            const idx = ((py + y) * sheet.width + (px + x)) * 4 + 3;
            if (data[idx] > 0) visible = true;
          }
        }
        if (visible) themes.push({ col, row });
      }
    }
  } catch (_) {
    // fallback: use a hardcoded safe subset
    for (let i = 0; i < 22 && i < cols; i++) themes.push({ col: i, row: 0 });
  }

  _terrainThemes = themes;
  return themes;
}

export function makeWorldDraw({ ctx, assetsReady, assets, world, player, getCanvasSize }){
  function isVisibleRect(x, y, w, h, margin = 160){
    const { vw, vh } = getCanvasSize();
    return x + w >= -margin && x <= vw + margin && y + h >= -margin && y <= vh + margin;
  }

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
      // Full-screen dark backdrop
      ctx.fillStyle = 'rgba(10, 0, 0, 0.88)';
      ctx.fillRect(0, 0, vw, vh);

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const cx = Math.round(vw / 2);
      const cy = Math.round(vh / 2);

      // Animated red pulse behind the title
      const pulse = 0.75 + Math.sin(performance.now() / 300) * 0.25;
      ctx.beginPath();
      ctx.arc(cx, cy - 60, 180 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180, 0, 0, ${0.12 * pulse})`;
      ctx.fill();

      // "GAME OVER" — giant, red, centered
      const titleSize = Math.max(52, Math.floor(vw / 10));
      ctx.font = `bold ${titleSize}px 'Press Start 2P', monospace`;
      // Black stroke for depth
      ctx.lineWidth = titleSize * 0.18;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
      ctx.strokeText('GAME OVER', cx, cy - 60);
      // Red gradient fill
      const grad = ctx.createLinearGradient(cx - 300, cy - 120, cx + 300, cy);
      grad.addColorStop(0, '#ff2222');
      grad.addColorStop(0.5, '#ff6060');
      grad.addColorStop(1, '#cc0000');
      ctx.fillStyle = grad;
      ctx.fillText('GAME OVER', cx, cy - 60);

      // Red glow
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 40;
      ctx.fillStyle = 'rgba(255, 80, 80, 0.35)';
      ctx.fillText('GAME OVER', cx, cy - 60);
      ctx.shadowBlur = 0;

      // Score display
      const scoreValue = Math.max(0, typeof window.__scoreForRender === 'number' ? window.__scoreForRender : 0);
      ctx.font = `bold 28px 'VT323', monospace`;
      ctx.fillStyle = '#ffd700';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 4;
      ctx.strokeText(`Score final : ${scoreValue} XP`, cx, cy + 30);
      ctx.fillText(`Score final : ${scoreValue} XP`, cx, cy + 30);

      // Separator line
      ctx.strokeStyle = 'rgba(255, 60, 60, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 220, cy + 60);
      ctx.lineTo(cx + 220, cy + 60);
      ctx.stroke();

      // Restart hint (blinking)
      const blink = Math.floor(performance.now() / 600) % 2 === 0;
      if (blink) {
        ctx.font = `bold 18px 'Press Start 2P', monospace`;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineWidth = 3;
        ctx.strokeText('CLIQUEZ POUR RECOMMENCER', cx, cy + 100);
        ctx.fillText('CLIQUEZ POUR RECOMMENCER', cx, cy + 100);
      }

      ctx.restore();
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
      if(!isVisibleRect(x, y, wplat, hplat)) continue;
      const theme = plat.theme || 0;
        if(plat.type === 'quiz_platform') {
          const difficulty = parseInt(plat.difficulty) || 1;
          const palette = difficulty >= 3
            ? { top: '#ff6b6b', base: '#ef4444', edge: '#991b1b', label: 'D' }
            : difficulty === 2
              ? { top: '#fde68a', base: '#f59e0b', edge: '#92400e', label: 'I' }
              : { top: '#86efac', base: '#22c55e', edge: '#166534', label: 'F' };
          const grad = ctx.createLinearGradient(x, y, x, y + hplat);
          grad.addColorStop(0, palette.top);
          grad.addColorStop(1, palette.base);
          ctx.fillStyle = grad;
          ctx.fillRect(x, y, wplat, hplat);
          ctx.fillStyle = palette.edge;
          ctx.fillRect(x, y + hplat - 5, wplat, 5);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 20px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`? ${palette.label}`, x + wplat/2, y + hplat/2 + 6);
          
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
          const themes = buildTerrainThemes();
          const hasValidThemes = themes.length > 0;
          const tileScale = 32;
          const ts = TERRAIN_TILE_W;

          if (hasValidThemes) {
            const tileIdx = theme % (themes.length + 1);
            const isPlatformPng = tileIdx === themes.length;

            if (isPlatformPng) {
              const tex = assets.platformVariants[0];
              if (tex && tex.width) {
                for (let tx = 0; tx < wplat; tx += tileScale) {
                  const drawW = Math.min(tileScale, wplat - tx);
                  ctx.drawImage(tex, 0, 0, tex.width, tex.height, x + tx, y, drawW, hplat + 8);
                }
              } else {
                ctx.fillStyle = '#776655';
                ctx.fillRect(x, y, wplat, hplat);
              }
            } else {
              const tile = themes[tileIdx % themes.length];
              const srcX = tile.col * ts;
              const srcY = tile.row * ts;
              const sW = ts;
              const sH = TERRAIN_TILE_H;

              const cCount = Math.ceil(wplat / tileScale);
              const rCount = Math.ceil(hplat / tileScale);

              for (let r = 0; r < rCount; r++) {
                for (let c = 0; c < cCount; c++) {
                  const drawX = x + c * tileScale;
                  const drawY = y + r * tileScale;
                  const drawW = Math.min(tileScale, x + wplat - drawX);
                  const drawH = Math.min(tileScale, y + hplat - drawY);
                  const sWc = (drawW / tileScale) * sW;
                  const sHc = (drawH / tileScale) * sH;
                  ctx.drawImage(assets.terrain_sheet, srcX, srcY, sWc, sHc, drawX, drawY, drawW, drawH);
                }
              }
            }
          } else if (assets.terrain_sheet && assets.terrain_sheet.width) {
            const ts2 = TERRAIN_TILE_W;
            const cCount = Math.ceil(wplat / tileScale);
            const rCount = Math.ceil(hplat / tileScale);
            for (let r = 0; r < rCount; r++) {
              for (let c = 0; c < cCount; c++) {
                const drawX = x + c * tileScale;
                const drawY = y + r * tileScale;
                const drawW = Math.min(tileScale, x + wplat - drawX);
                const drawH = Math.min(tileScale, y + hplat - drawY);
                const srcX = (c % 22) * ts2;
                const srcY = 0;
                const sWc = (drawW / tileScale) * ts2;
                const sHc = (drawH / tileScale) * TERRAIN_TILE_H;
                ctx.drawImage(assets.terrain_sheet, srcX, srcY, sWc, sHc, drawX, drawY, drawW, drawH);
              }
            }
          } else {
            const variants = assets.platformVariants.length ? assets.platformVariants : [null];
            const tex = variants[theme % variants.length] || assets.platformVariants[0];
            if (tex && tex.width) {
              for (let tx = 0; tx < wplat; tx += tileScale) {
                const drawW = Math.min(tileScale, wplat - tx);
                ctx.drawImage(tex, 0, 0, tex.width, tex.height, x + tx, y, drawW, hplat + 8);
              }
            } else {
              ctx.fillStyle = '#776655';
              ctx.fillRect(x, y, wplat, hplat);
            }
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
    
    // Draw Trampolines
    if(world.trampolines){
      for(const t of world.trampolines){
        const tx = Math.round(t.x - camX);
        const ty = Math.round(t.y - camY);
        if(!isVisibleRect(tx, ty, t.w, t.h)) continue;
        const img = (t.triggered > 0) ? assets.trampoline_jump : assets.trampoline_idle;
        if(useTextures && img && img.width){
          ctx.drawImage(img, tx, ty, t.w, t.h);
        } else {
          ctx.fillStyle = t.triggered > 0 ? '#e67e22' : '#d35400';
          ctx.fillRect(tx, ty + (t.triggered > 0 ? 0 : 10), t.w, t.h - (t.triggered > 0 ? 0 : 10));
        }
      }
    }
  }

  function drawCoins(camX, camY, useTextures){
    for(const c of world.coins){
      if(c.collected) continue;
      const cx = Math.round(c.x - camX);
      const cy = Math.round(c.y - camY);
      if(!isVisibleRect(cx - 32, cy - 32, 64, 64)) continue;
      
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

  function drawLivres(camX, camY, useTextures){
    if(!world.livres) return;
    for(const l of world.livres){
      if(l.collected) continue;
      const lx = Math.round(l.x - camX);
      const ly = Math.round(l.y - camY);
      
      if (!l.type || l.type === 'livre') {
        if(useTextures && assets.livre && assets.livre.width){
          ctx.drawImage(assets.livre, lx - 18, ly - 18, 36, 36);
        } else {
          ctx.save();
          ctx.fillStyle = '#3498db';
          ctx.fillRect(lx - 12, ly - 16, 24, 32);
          ctx.fillStyle = '#f1c40f';
          ctx.fillRect(lx - 10, ly - 12, 4, 24);
          ctx.restore();
        }
      } else if (l.type === 'fragments') {
        for (const frag of l.fragments) {
          if (frag.collected) continue;
          const fx = Math.round(frag.x - camX);
          const fy = Math.round(frag.y - camY) + Math.sin(performance.now()/200 + frag.x)*5;
          if(!isVisibleRect(fx - 28, fy - 28, 56, 56)) continue;
          if(useTextures && assets.scroll_fragment && assets.scroll_fragment.width){
             ctx.drawImage(assets.scroll_fragment, fx - 24, fy - 24, 48, 48);
          } else {
             ctx.fillStyle = '#f1c40f';
             ctx.fillRect(fx - 10, fy - 10, 20, 20);
          }
        }
      } else if (l.type === 'crystal') {
        const bob = Math.sin(performance.now()/300)*8;
        if(useTextures && assets.knowledge_crystal && assets.knowledge_crystal.width){
           ctx.drawImage(assets.knowledge_crystal, lx - 48, ly - 64 + bob, 96, 128);
        } else {
           ctx.fillStyle = '#9b59b6';
           ctx.beginPath();
           ctx.moveTo(lx, ly - 30 + bob);
           ctx.lineTo(lx + 20, ly + bob);
           ctx.lineTo(lx, ly + 30 + bob);
           ctx.lineTo(lx - 20, ly + bob);
           ctx.fill();
        }
        const p = l.progress || 0;
        if (p > 0) {
          ctx.beginPath();
          ctx.arc(lx, ly + bob, 160, 0, Math.PI*2);
          ctx.fillStyle = `rgba(155, 89, 182, ${0.1 + (p/2)*0.2})`;
          ctx.fill();
        }
      } else if (l.type === 'switch_door') {
        const bx = Math.round(l.x - camX);
        const by = Math.round(l.y - camY);
        const dx = Math.round(l.doorX - camX);
        const dy = Math.round(l.doorY - camY);

        if(isVisibleRect(bx - 28, by - 44, 56, 48)){
          if(useTextures && assets.switch_button && assets.switch_button.width){
             const sh = l.doorOpen ? 20 : 40;
             const sy = l.doorOpen ? by - 20 : by - 40;
             ctx.drawImage(assets.switch_button, bx - 24, sy, 48, sh);
          } else {
             ctx.fillStyle = l.doorOpen ? '#27ae60' : '#e74c3c';
             ctx.fillRect(bx - 16, by - (l.doorOpen ? 10 : 20), 32, (l.doorOpen ? 10 : 20));
          }
        }

        if (!l.doorOpen && isVisibleRect(dx - 50, dy - 104, 100, 200)) {
          if(useTextures && assets.door_closed && assets.door_closed.width){
             ctx.drawImage(assets.door_closed, dx - 48, dy - 100, 96, 192);
          } else {
             ctx.fillStyle = '#7f8c8d';
             ctx.fillRect(dx - 30, dy - 60, 60, 120);
          }
        } else if (l.doorOpen && isVisibleRect(dx - 50, dy - 64, 100, 128)) {
          ctx.beginPath();
          ctx.fillStyle = 'rgba(46, 204, 113, 0.4)';
          ctx.fillRect(dx - 30, dy - 60, 60, 120);
          const bob = Math.sin(performance.now()/200)*5;
          if(useTextures && assets.livre && assets.livre.width){
            ctx.drawImage(assets.livre, dx - 18, dy - 18 + bob, 36, 36);
          }
        }
      } else if (l.type === 'npc') {
        const bob = Math.sin(performance.now()/250)*4;
        if(useTextures && assets.npc_sage && assets.npc_sage.width){
           ctx.drawImage(assets.npc_sage, lx - 48, ly - 64 + bob, 96, 128);
        } else {
           ctx.fillStyle = '#ecf0f1';
           ctx.fillRect(lx - 20, ly - 30 + bob, 40, 60);
        }
        ctx.fillStyle = '#fff';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💬', lx, ly - 40 + bob);
      } else if (l.type === 'mirror') {
        const bob = Math.sin(performance.now()/150)*10;
        ctx.beginPath();
        ctx.arc(lx, ly + bob, 30, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(52, 152, 219, 0.8)';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillStyle = 'rgba(52, 152, 219, 0.3)';
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#000';
        ctx.fillText('Double Saut !', lx, ly - 40 + bob);
        ctx.shadowBlur = 0;
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
      if(!isVisibleRect(ex - 80, ey - 80, (e.w || 40) + 160, (e.h || 48) + 180)) continue;
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
          let frame = 0;
          let srcW = 0, srcH = 0;
          
          if(e.type === 'saw'){
            img = assets.saw_on;
            srcW = 38; srcH = 38;
            frame = Math.floor(performance.now()/50) % 8; // fast spinning
          } else if(e.type === 'spike_head'){
            img = assets.spike_head;
            srcW = 54; srcH = 52;
            frame = Math.floor(performance.now()/200) % 4; // blinking/idle
          } else if(e.type === 'ninja_frog'){
            img = e.grounded ? assets.ninja_frog_run : assets.ninja_frog_idle;
            srcW = 32; srcH = 32;
            frame = Math.floor(performance.now()/(e.grounded?80:150)) % 11;
          } else if(e.type === 'fire'){
            img = assets.fire_on;
            srcW = 16; srcH = 32;
            frame = Math.floor(performance.now()/150) % 3; // Animated fire
          } else if(e.type && e.type === 'beast' && assets.enemyWalk.length){
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
              if (srcW) {
                 const f = frame % Math.max(1, Math.floor(img.width/srcW));
                 ctx.drawImage(img, f*srcW, 0, srcW, srcH, 0, ey, ew, eh);
              } else {
                 ctx.drawImage(img, 0, 0, img.width, img.height, 0, ey, ew, eh);
              }
            } else {
              if (srcW) {
                 const f = frame % Math.max(1, Math.floor(img.width/srcW));
                 ctx.drawImage(img, f*srcW, 0, srcW, srcH, ex, ey, ew, eh);
              } else {
                 ctx.drawImage(img, 0, 0, img.width, img.height, ex, ey, ew, eh);
              }
            }
            ctx.restore();
          } else {
            ctx.fillStyle = e.flying ? '#f0c86b' : '#b94b42';
            ctx.fillRect(ex, ey, ew, eh);
          }
        }
      }
    }
  }

  return {
    drawSky,
    drawBanners,
    drawPlatforms,
    drawCoins,
    drawLivres,
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
