import { player } from './level.js';

export function initChatbot() {
  // Ensure player has queries and coins initialized
  player.aiQueries = player.aiQueries !== undefined ? player.aiQueries : 1;
  player.coins = player.coins !== undefined ? player.coins : 0;

  const toggleBtn = document.getElementById('chatbotToggle');
  const panel = document.getElementById('chatbotPanel');
  const closeBtn = document.getElementById('chatbotClose');
  const form = document.getElementById('chatbotForm');
  const input = document.getElementById('chatbotInput');
  const messagesContainer = document.getElementById('chatbotMessages');
  const queriesCount = document.getElementById('chatbotQueriesCount');
  const buyBtn = document.getElementById('btnBuyQuery');

  if (!toggleBtn || !panel || !closeBtn || !form || !input || !messagesContainer || !queriesCount || !buyBtn) {
    console.warn("[Chatbot] Missing DOM elements");
    return;
  }

  // Update UI displays
  function updateChatbotUI() {
    queriesCount.textContent = `💬 ${player.aiQueries} Question${player.aiQueries > 1 ? 's' : ''}`;
  }

  // Periodic UI sync (for coins/queries)
  setInterval(updateChatbotUI, 300);

  // Toggle Panel
  toggleBtn.addEventListener('click', () => {
    panel.classList.remove('hidden');
    toggleBtn.classList.add('hidden');
    updateChatbotUI();
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });

  closeBtn.addEventListener('click', () => {
    panel.classList.add('hidden');
    toggleBtn.classList.remove('hidden');
  });

  // Buy Query
  buyBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const cost = 5;
    if ((player.coins || 0) >= cost) {
      player.coins -= cost;
      player.aiQueries = (player.aiQueries || 0) + 1;
      updateChatbotUI();
      addBotMessage("Transaction réussie ! +1 question ajoutée. 🤖 (Reste: " + player.coins + " 🪙)");
    } else {
      addBotMessage("❌ Pas assez de pièces ! Il te faut 5 🪙 (Tu en as " + (player.coins || 0) + ").");
    }
  });

  // Add bot message helper
  function addBotMessage(text) {
    const msg = document.createElement('div');
    msg.className = 'chat-message bot';
    msg.innerHTML = `
      <div class="chat-sender">BOT</div>
      <div class="chat-bubble">${text}</div>
    `;
    messagesContainer.appendChild(msg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Add user message helper
  function addUserMessage(text) {
    const msg = document.createElement('div');
    msg.className = 'chat-message user';
    msg.innerHTML = `
      <div class="chat-sender">TOI</div>
      <div class="chat-bubble">${text}</div>
    `;
    messagesContainer.appendChild(msg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Form submission
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const queryText = input.value.trim();
    if (!queryText) return;

    if ((player.aiQueries || 0) <= 0) {
      addBotMessage("⚠️ Tu n'as plus de questions disponibles ! Récolte des pièces et achète-en une.");
      input.value = '';
      return;
    }

    // Spend query
    player.aiQueries--;
    updateChatbotUI();

    // Show user message
    addUserMessage(queryText);
    input.value = '';

    // Show bot thinking state
    const thinkingMsg = document.createElement('div');
    thinkingMsg.className = 'chat-message bot thinking';
    thinkingMsg.innerHTML = `
      <div class="chat-sender">BOT</div>
      <div class="chat-bubble">Réflexion IA en cours... ⚙️</div>
    `;
    messagesContainer.appendChild(thinkingMsg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Simulate API delay and response
    setTimeout(() => {
      thinkingMsg.remove();
      // Simple mock answers or responses
      let reply = "Je suis connecté au monde " + (window.currentLevel || 1) + ". Pose-moi une question sur le cours ! (Bientôt relié à l'API LLM)";
      if (queryText.toLowerCase().includes('aide') || queryText.toLowerCase().includes('help')) {
        reply = "Besoin d'aide ? Saute sur les plateformes dorées avec un point d'interrogation (?) pour répondre aux quiz. Évite les ennemis et tire-leur dessus avec ESPACE !";
      } else if (queryText.toLowerCase().includes('piece') || queryText.toLowerCase().includes('boutique') || queryText.toLowerCase().includes('pièce')) {
        reply = "Tu gagnes des pièces (🪙) en explorant les niveaux. 5 pièces te permettent d'acheter 1 requête IA !";
      } else if (queryText.toLowerCase().includes('hello') || queryText.toLowerCase().includes('salut') || queryText.toLowerCase().includes('bonjour')) {
        reply = "Bonjour jeune aventurier ! Que puis-je faire pour toi aujourd'hui ?";
      }
      addBotMessage(reply);
    }, 1200);
  });
}
