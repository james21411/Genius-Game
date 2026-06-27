# Configuration du Chatbot IA avec Gemini

## 🚀 Étapes de configuration

### 1. Obtenir votre clé API Gemini

1. Allez sur [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Cliquez sur "Créer une clé API"
3. Choisissez "Nouveau projet" ou sélectionnez un projet existant
4. Copier la clé API générée

### 2. Configurer le fichier .env

1. Ouvrez `/backend/.env`
2. Remplacez `YOUR_GEMINI_API_KEY_HERE` par votre clé API :
```env
GEMINI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx
GEMINI_MODEL_NAME=gemini-2.5-flash
```

### 3. Installer les dépendances

```bash
cd backend
pip install -r requirements.txt
```

### 4. Démarrer le serveur Flask

```bash
python app.py
```

Vous devriez voir :
```
✅ Gemini API configurée avec le modèle: gemini-2.5-flash
✅ Base de connaissance chargée (6 sections)
 * Running on http://localhost:5001
```

## 📚 Architecture du Chatbot

### Composants

1. **Frontend** (`game/chatbot.js`)
   - Interface utilisateur du chatbot dans le jeu
   - Gestion des requêtes et des réponses
   - Affichage des messages

2. **Backend** (`backend/app.py`)
   - Endpoint `/api/chat` qui appelle Gemini
   - Chargement de la base de connaissance
   - Contextualisation basée sur le monde du jeu

3. **Base de Connaissance** (`backend/knowledge_base.json`)
   - Mécanique du jeu
   - Conseils éducatifs
   - Structures thématiques des mondes
   - Dépannage

## 🧠 Base de Connaissance

La base de connaissance (`knowledge_base.json`) contient :

### Sections

- **game_mechanics** : Contrôles, pièces, quiz, ennemis
- **educational_tips** : Stratégies d'apprentissage, système XP
- **world_themes** : Descriptions des mondes et concepts clés
- **difficulty_levels** : Explications des modes de difficulté
- **troubleshooting** : Solutions aux problèmes courants
- **ai_assistant_tips** : Comment utiliser efficacement le chatbot

## 💰 Système de Requêtes

- Le joueur commence avec **1 requête IA** gratuite
- Chaque question coûte **1 requête**
- **5 pièces = 1 requête supplémentaire**
- Les requêtes se renouvellent avec les niveaux

## 🔒 Sécurité

⚠️ **IMPORTANT** :
- Le fichier `.env` ne doit JAMAIS être commité dans Git
- Le `.gitignore` du backend exclut automatiquement `.env`
- Ne partagez JAMAIS votre clé API publiquement

## 🛠️ Dépannage

### Le chatbot ne répond pas

1. Vérifiez que la clé API est correcte dans `.env`
2. Vérifiez que le serveur Flask est en cours d'exécution sur `http://localhost:5001`
3. Ouvrez la console du navigateur (F12) et vérifiez les erreurs réseau
4. Vérifiez les logs du serveur Flask

### Erreur "Chatbot IA non configuré"

- La clé API `GEMINI_API_KEY` n'est pas définie ou est vide
- Assurez-vous que `.env` est dans le dossier `/backend`
- Redémarrez le serveur Flask après modification du `.env`

### Réponses lentes

- Les modèles Gemini peuvent être légèrement lents (1-2 secondes)
- C'est normal, le jeu affiche un indicateur de chargement
- Si c'est trop lent, essayez avec une connexion Internet plus rapide

## 📝 Personnalisation

### Modifier la base de connaissance

Éditez `backend/knowledge_base.json` pour ajouter :
- Nouveaux concepts éducatifs
- Conseils de gameplay
- Mondes supplémentaires

Les changements prennent effet au redémarrage du serveur.

### Modifier le ton du chatbot

Éditez le prompt dans `backend/app.py` (fonction `chat_with_gemini`) :
- Changez "GeniusBot" pour un autre nom
- Modifiez les directives pour ajuster le ton
- Ajoutez des contraintes personnalisées

## 🎮 Intégration dans le jeu

Le chatbot s'intègre automatiquement si :
1. Le bouton "💬" est visible dans le jeu
2. Le backend Flask est en cours d'exécution
3. La clé API Gemini est configurée

Les joueurs peuvent :
- Poser des questions sur le gameplay
- Demander des indices sur les quiz
- Demander des explications sur les concepts éducatifs

## 📊 Statistiques

Le backend suit :
- Nombre de requêtes IA utilisées par étudiant
- Coût en pièces
- Historique des conversations (optionnel)

Vous pouvez exporter ces données pour l'analyse pédagogique.

---

**Questions ?** Consultez la documentation Gemini : [Google AI Python SDK](https://ai.google.dev/tutorials/python_quickstart)
