import { getNextQuestionHint } from './quiz_engine.js';

export function initLivreDialog() {
  window.isLivreActive = false;

  const overlay = document.getElementById('livreOverlay');
  const textContainer = document.getElementById('livreText');
  const closeBtn = document.getElementById('livreCloseBtn');
  const readBtn = document.getElementById('livreReadBtn');

  if (!overlay || !textContainer || !closeBtn || !readBtn) {
    console.warn("[Livre] Missing DOM elements");
    return;
  }

  function closeDialog() {
    overlay.classList.add('hidden');
    window.isLivreActive = false;
  }

  window.addEventListener('livre-collected', (e) => {
    window.isLivreActive = true;
    
    // Fetch details of the upcoming quiz question dynamically
    const info = getNextQuestionHint();
    if (info) {
      textContainer.innerHTML = `
        <strong style="color: #8e44ad; font-size: 24px;">CONSEIL DE L'IA :</strong><br>
        <span style="color: #666; font-size: 18px; font-style: italic;">Pour la question : "${info.question}"</span><br><br>
        <span style="font-weight: bold; color: #111; font-size: 22px;">💡 Clé pédagogique :</span> ${info.hint}
      `;
    } else {
      textContainer.innerHTML = `
        <strong style="color: #8e44ad; font-size: 24px;">GRIMOIRE MYSTIQUE :</strong><br><br>
        Révise tes cours de mathématiques et de sciences pour remporter l'aventure Genius !
      `;
    }

    // Open Modal Dialog
    overlay.classList.remove('hidden');
  });

  closeBtn.addEventListener('click', closeDialog);
  readBtn.addEventListener('click', closeDialog);
}
