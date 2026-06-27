import { assetsReady, assets } from './assets.js';
import { world, player } from './level.js';
import { makeDrawHelpers } from './render_helpers.js';

let canvas, ctx, DPR = Math.max(1, window.devicePixelRatio || 1);
let helpers = null;
// remember last frame camera Y so we can smoothly follow the player and avoid
// sudden downward snaps that make platforms appear to fall.
let lastCamY = 0;

// initialize renderer and helpers
export function initRender(c, worldRef, playerRef, assetObj, assetsReadyFn){
  canvas = c;
  ctx = canvas.getContext('2d');

  function resize(){
    const w = innerWidth;
    const h = innerHeight;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    DPR = Math.max(1, devicePixelRatio || 1);
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
  }
  resize();
  addEventListener('resize', resize);

  // create drawing helpers with injected references (keeps this module small)
  helpers = makeDrawHelpers({ ctx, assetsReady, assets, world, player, getCanvasSize: () => ({ width: canvas.width, vw: canvas.clientWidth, vh: canvas.clientHeight, DPR }) });
}

// main draw function delegates all detailed work to helpers
export function draw(){
  if(!canvas || !ctx || !helpers) return;
  const { vw, vh } = { vw: canvas.clientWidth, vh: canvas.clientHeight };
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // compute camera (kept here to keep helpers focused on drawing)
  let camX = player.x + player.w/2 - vw/2;
  camX = Math.max(0, Math.min(world.width - vw, camX));

  // Keep vertical camera fixed to base ground reference so platforms remain stationary.
  // This prevents the camera from following vertical player movement and makes platforms appear fixed.
  const groundReferenceY = 760;
  const groundScreenY = Math.round(vh * 0.82);
  let baseCamY = groundReferenceY - groundScreenY;
  baseCamY = Math.max(0, Math.min(world.height - vh, baseCamY));

  // Use fixed camera Y anchored at baseCamY (no smooth follow up/down)
  let camY = baseCamY;

  // final clamp to world bounds (safety)
  camY = Math.max(0, Math.min(world.height - vh, camY));

  // store for next frame
  lastCamY = camY;

  // draw sequence
  helpers.drawSky(vw, vh);
  helpers.drawBanners(camX, vw, vh);
  // ground
  ctx.fillStyle = '#2f6b2f';
  ctx.fillRect(0, vh*0.82, vw, vh*0.18);

  const useTextures = assetsReady();
  helpers.drawPlatforms(camX, camY, useTextures);
  helpers.drawCoins(camX, camY, useTextures);
  helpers.drawLivres(camX, camY, useTextures);
  helpers.drawEnemies(camX, camY, useTextures);
  helpers.drawProjectiles(camX, camY);
  helpers.drawPlayer(camX, camY, useTextures);
  helpers.drawAmmoAndHUD(camX, camY, useTextures);

  // draw menu / game over overlay if state is not playing
  if(typeof window.gameState !== 'undefined' && window.gameState !== 'playing'){
    if(helpers.drawOverlay) helpers.drawOverlay(vw, vh);
    // On redessine le joueur AU DESSUS du menu pour qu'il soit visible et animé
    if(window.gameState === 'menu') {
      helpers.drawPlayer(camX, camY, useTextures);
    }
  }
}
