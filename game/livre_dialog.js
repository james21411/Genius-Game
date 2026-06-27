import { getNextQuestionHint } from './quiz_engine.js';

export function initLivreDialog() {
  window.isLivreActive = false;
  window.collectedHints = window.collectedHints || [];

  const overlay = document.getElementById('livreOverlay');
  const textContainer = document.getElementById('livreText');
  const closeBtn = document.getElementById('livreCloseBtn');
  const readBtn = document.getElementById('livreReadBtn');

  // History panel elements
  const historyToggle = document.getElementById('bookHistoryToggle');
  const historyPanel = document.getElementById('bookHistoryPanel');
  const historyClose = document.getElementById('bookHistoryClose');
  const historyList = document.getElementById('bookHistoryList');

  if (!overlay || !textContainer || !closeBtn || !readBtn || !historyToggle || !historyPanel || !historyClose || !historyList) {
    console.warn("[Livre] Missing DOM elements");
    return;
  }

  function closeDialog() {
    overlay.classList.add('hidden');
    window.isLivreActive = false;
    window.updateMenuVisibility?.();
  }

  window.addEventListener('livre-collected', (e) => {
    window.isLivreActive = true;
    window.updateMenuVisibility?.();
    
    // Fetch details of the upcoming quiz question dynamically
    const info = getNextQuestionHint();
    if (info) {
      // Add to history list if not already present
      if (!window.collectedHints.some(h => h.question === info.question)) {
        window.collectedHints.push(info);
      }

      textContainer.innerHTML = `
        <strong style="color: #8e44ad; font-size: 24px;">CONSEIL DU GRIMOIRE :</strong><br>
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

  // --- History Index Panel Logic ---
  function updateHistoryList() {
    if (window.collectedHints.length === 0) {
      historyList.innerHTML = `<div class="history-empty-state">Aucun grimoire collecté. Explore les niveaux pour trouver des indices !</div>`;
    } else {
      historyList.innerHTML = window.collectedHints.map(item => `
        <div class="history-item">
          <div class="history-item-q">Q: ${item.question}</div>
          <div class="history-item-h">💡 ${item.hint}</div>
        </div>
      `).join('');
    }
  }

  historyToggle.addEventListener('click', () => {
    updateHistoryList();
    historyPanel.classList.toggle('hidden');
  });

  historyClose.addEventListener('click', () => {
    historyPanel.classList.add('hidden');
  });
}
