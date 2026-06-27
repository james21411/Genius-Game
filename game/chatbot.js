import { player } from './level.js';

const API_BASE = 'http://localhost:5001/api';
const CHATBOT_QUERY_COST = 10;

// Historique conversationnel local
let chatHistory = [];

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
    queriesCount.textContent = `${player.coins || 0} pièces • ${CHATBOT_QUERY_COST} pièces/question`;
  }

  // Les questions se paient directement à l'envoi.
  buyBtn.style.display = 'none';

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
      addBotMessage("Transaction réussie ! +1 question ajoutée. Reste: " + player.coins + " pièces.");
    } else {
      addBotMessage("Pas assez de pièces ! Il te faut 5 pièces. Tu en as " + (player.coins || 0) + ".");
    }
  });

  // Add bot message helper
  function addBotMessage(text) {
    const msg = document.createElement('div');
    msg.className = 'chat-message bot';
    msg.innerHTML = `
      <div class="chat-sender">GUIDE</div>
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
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const queryText = input.value.trim();
    if (!queryText) return;
    if ((player.coins || 0) < CHATBOT_QUERY_COST) {
      updateChatbotUI();
      addBotMessage(`Il te faut ${CHATBOT_QUERY_COST} pièces pour poser une question. Tu en as ${player.coins || 0}.`);
      return;
    }

    player.coins = Math.max(0, (player.coins || 0) - CHATBOT_QUERY_COST);

    updateChatbotUI();

    // Show user message
    addUserMessage(queryText);
    
    // Add to history
    chatHistory.push({ sender: 'user', text: queryText });
    
    input.value = '';

    // Build game context
    const gameContext = {
      lives: player.lives || 3,
      coins: player.coins || 0,
      last_wrong_answer: window.lastWrongQuestion || null
    };

    // Show bot thinking state
    const thinkingMsg = document.createElement('div');
    thinkingMsg.className = 'chat-message bot thinking';
    thinkingMsg.innerHTML = `
      <div class="chat-sender">GUIDE</div>
      <div class="chat-bubble">Recherche de réponse en cours...</div>
    `;
    messagesContainer.appendChild(thinkingMsg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
      // Ask the backend for an answer.
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: queryText,
          world_id: window.currentWorldId || null,
          student_name: window.studentName || 'Aventurier',
          student_id: window.studentId || null,
          history: chatHistory,
          game_context: gameContext
        })
      });

      thinkingMsg.remove();

      if (!response.ok) {
        const error = await response.json();
        addBotMessage(`Erreur: ${error.error || 'Impossible de contacter le service'}`);
        return;
      }

      const data = await response.json();
      
      // Parse markdown bold (e.g. **text**)
      const formattedReply = data.reply.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      
      addBotMessage(formattedReply);
      
      // Add to history
      chatHistory.push({ sender: 'model', text: data.reply });
      
      // Keep only last 10 messages to avoid huge payload
      if (chatHistory.length > 10) {
          chatHistory = chatHistory.slice(-10);
      }
      
    } catch (error) {
      thinkingMsg.remove();
      console.error('Erreur chatbot:', error);
      addBotMessage(`Erreur de connexion. Essaie à nouveau !`);
    }
  });
}
