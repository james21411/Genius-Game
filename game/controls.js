/*
Module: game/controls.js
Sets up mobile (nipplejs) or keyboard controls and exposes an input object.
*/
import nipplejs from "nipplejs";

export const input = { left:0, right:0, jump:false, shoot:false };
export const isMobile = /Mobi|Android/i.test(navigator.userAgent);

function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function initControls(){
  if(isMobile){
    const joyZone = document.getElementById('joy');
    const manager = nipplejs.create({
      zone: joyZone,
      mode: 'static',
      position: { left: '50%', top: '50%' },
      color: 'rgba(255,255,255,0.12)'
    });
    manager.on('move', (evt, data) => {
      const angle = data.angle ? data.angle.radian : 0;
      const dist = Math.min(1, data.distance / 80);
      const dx = Math.cos(angle) * dist;
      input.left = dx < -0.3 ? -Math.abs(dx) : 0;
      input.right = dx > 0.3 ? Math.abs(dx) : 0;
    });
    manager.on('end', ()=>{ input.left = input.right = 0; });
    const jumpBtn = document.getElementById('jump');
    jumpBtn.addEventListener('touchstart', (e)=>{ e.preventDefault(); input.jump = true; });
    jumpBtn.addEventListener('touchend', (e)=>{ e.preventDefault(); input.jump = false; });
    // on mobile: tap canvas to shoot
    const canvas = document.getElementById('game');
    canvas.addEventListener('touchstart', (e)=>{ 
      if(e.touches.length === 1){
        input.shoot = true;
        setTimeout(()=>{ input.shoot = false; }, 120);
      }
    });

  } else {
    addEventListener('keydown', (e)=>{
      if (isTypingTarget(e.target)) return;
      const quizOpen = window.isQuizActive?.() || false;
      if(e.key === 'ArrowLeft' || e.key === 'a') input.left = -1;
      if(e.key === 'ArrowRight' || e.key === 'd') input.right = 1;
      // keep W and ArrowUp for jump; map Space to shoot so player can fire with spacebar
      if(e.key === 'w' || e.key === 'ArrowUp') input.jump = true;
      // Bloquer le tir quand quiz actif (overlay ouvert) pour éviter les tirs accidentels
      if (!quizOpen) {
        if(e.key === ' ' || e.key === 'k' || e.key === 'K' || e.key === 'Control') input.shoot = true;
      }
    });
    addEventListener('keyup', (e)=>{
      if (isTypingTarget(e.target)) return;
      if(e.key === 'ArrowLeft' || e.key === 'a') if(input.left<0) input.left = 0;
      if(e.key === 'ArrowRight' || e.key === 'd') if(input.right>0) input.right = 0;
      if(e.key === 'w' || e.key === 'ArrowUp') input.jump = false;
      if(e.key === ' ' || e.key === 'k' || e.key === 'K' || e.key === 'Control') input.shoot = false;
    });
  }
}
