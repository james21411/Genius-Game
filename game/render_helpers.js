import { assetsReady, assets } from './assets.js';
import { makeWorldDraw } from './render/world_draw.js';
import { makeEntitiesDraw } from './render/entities_draw.js';
import { makeHudDraw } from './render/hud_draw.js';

// factory that composes focused draw modules into one helpers object
export function makeDrawHelpers(opts){
  const { ctx, world, player, getCanvasSize } = opts;
  const worldDraw = makeWorldDraw({ ctx, assetsReady, assets, world, player, getCanvasSize });
  const entitiesDraw = makeEntitiesDraw({ ctx, assetsReady, assets, world, player, getCanvasSize });
  const hudDraw = makeHudDraw({ ctx, assetsReady, assets, world, player, getCanvasSize });

  // expose a single unified API expected by render.js
  return {
    drawSky: worldDraw.drawSky,
    drawBanners: worldDraw.drawBanners,
    drawPlatforms: worldDraw.drawPlatforms,
    drawCoins: worldDraw.drawCoins,
    drawLivres: worldDraw.drawLivres,
    drawEnemies: worldDraw.drawEnemies,
    drawProjectiles: entitiesDraw.drawProjectiles,
    drawPlayer: entitiesDraw.drawPlayer,
    drawAmmoAndHUD: hudDraw.drawAmmoAndHUD,
    drawOverlay: worldDraw.drawOverlay
  };
}

/*
Tombstones (moved large functions into smaller modules):
// removed large monolithic drawing implementation (now split into world_draw, entities_draw, hud_draw)
*/