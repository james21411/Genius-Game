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
    if (typeof player !== 'undefined' && player) player.invulnerable = 1.2;
    window.updateMenuVisibility?.();

    const fragments = e.detail?.fragments || [];
    const hasLessonContent = fragments.some(f => f.content);

    if (hasLessonContent && window.gameMode === 'lesson') {
      // Show actual lesson content from collected fragments
      const usedColors = ['#f5c04a', '#2ecc71', '#3498db'];
      textContainer.innerHTML = fragments.map((f, i) => `
        <div class="lesson-fragment-dialog-item" style="margin-bottom: ${i < fragments.length - 1 ? '16px' : '0'}; padding: 12px; background: rgba(255,255,255,0.04); border-left: 4px solid ${usedColors[i % usedColors.length]}; border-radius: 6px;">
          <strong style="color: ${usedColors[i % usedColors.length]}; font-family: 'Press Start 2P'; font-size: 9px; display: block; margin-bottom: 8px;">
            Fragment ${f.order_index || i + 1}/${fragments.length} : ${f.title || 'Leçon'}
          </strong>
          ${f.image_data
            ? (f.image_data.startsWith('data:image')
              ? `<img src="${f.image_data}" alt="" style="max-width: 100%; max-height: 120px; border-radius: 6px; margin-bottom: 8px; display: block;">`
              : `<div style="background: #2c3e50; padding: 8px; border-radius: 6px; margin-bottom: 8px; font-size: 13px; text-align: center;">${f.image_data}</div>`)
            : ''}
          <p style="margin: 0; line-height: 1.5; font-size: 14px;">${f.content}</p>
        </div>
      `).join('');

      // Also add to history as fragments
      for (const f of fragments) {
        if (f.title && !window.collectedHints.some(h => h.question === f.title)) {
          window.collectedHints.push({
            question: f.title,
            hint: f.content?.substring(0, 100) + (f.content?.length > 100 ? '...' : ''),
            lessonContent: f.content,
            lessonTitle: f.title
          });
        }
      }
    } else {
      // Fallback: show hint about next quiz question (existing behavior)
      const info = getNextQuestionHint();
      if (info) {
        if (!window.collectedHints.some(h => h.question === info.question)) {
          window.collectedHints.push(info);
        }
        textContainer.innerHTML = `
          <strong class="grimoire-heading">CONSEIL DU GRIMOIRE :</strong><br>
          <span class="grimoire-question">Pour la question : "${info.question}"</span><br><br>
          <span class="grimoire-key">Clé pédagogique :</span> ${info.hint}
        `;
      } else {
        textContainer.innerHTML = `
          <strong class="grimoire-heading">GRIMOIRE MYSTIQUE :</strong><br><br>
          Révise tes cours de mathématiques et de sciences pour remporter l'aventure Genius !
        `;
      }
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
        <div class="history-item" style="${item.lessonContent ? 'border-left: 3px solid #f5c04a;' : ''}">
          <div class="history-item-q">${item.lessonContent ? '📖' : 'Q:'} ${item.question}</div>
          <div class="history-item-h">${item.hint}</div>
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
