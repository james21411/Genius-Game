# 🤖 Chatbot IA - Guide Rapide d'Utilisation

## ✅ Ce qui a été fait

### 1. **Sécurité de la clé API**
- ✅ Créé `.env` pour stocker la clé API de manière sécurisée
- ✅ Ajouté `.gitignore` pour exclure `.env` de Git
- ✅ Les dépendances `python-dotenv` et `google-generativeai` ajoutées

### 2. **Backend Gemini**
- ✅ Modifié `app.py` pour charger `python-dotenv`
- ✅ Créé endpoint `/api/chat` qui utilise Gemini
- ✅ Chargement automatique de la base de connaissances

### 3. **Frontend du Chatbot**
- ✅ Modifié `chatbot.js` pour appeler le nouvel endpoint
- ✅ Remplacement des réponses mock par des appels à l'IA
- ✅ Affichage d'un indicateur de chargement pendant la réflexion

### 4. **Base de Connaissance**
- ✅ Créé `knowledge_base.json` avec:
  - Mécanique du jeu
  - Conseils éducatifs
  - Descriptions des mondes
  - Dépannage et FAQ

### 5. **Documentation**
- ✅ Guide complet `CHATBOT_SETUP.md`
- ✅ Script de test `test_gemini.py`

---

## 🚀 Démarrage Rapide

### Étape 1: Obtenir la clé API Gemini
1. Allez sur https://aistudio.google.com/app/apikey
2. Cliquez "Créer une clé API"
3. Copiez la clé

### Étape 2: Configurer .env
```bash
cd backend
# Ouvrez le fichier .env et remplacez:
# GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
# Par:
# GEMINI_API_KEY=votre_clé_copiée_ici
```

### Étape 3: Installer les dépendances
```bash
pip install -r requirements.txt
```

### Étape 4: Tester la configuration
```bash
python test_gemini.py
```

Vous devriez voir:
```
✅ Clé API détectée
✅ Modèle configuré: gemini-2.5-flash
✅ Base de connaissance chargée (6 sections)
✅ Connexion Gemini réussie
✅ Tous les tests sont passés!
```

### Étape 5: Démarrer le serveur
```bash
python app.py
```

Vous devriez voir:
```
✅ Gemini API configurée avec le modèle: gemini-2.5-flash
✅ Base de connaissance chargée (6 sections)
 * Running on http://localhost:5001
```

---

## 🎮 Utilisation dans le Jeu

1. Le chatbot s'active automatiquement si l'API est configurée
2. Cliquez sur le bouton 💬 dans le jeu
3. Posez une question
4. Le chatbot répond en 1-3 secondes

### Exemples de questions:
- "Comment utiliser les contrôles ?"
- "Pourquoi j'ai perdu ma première vie ?"
- "Comment gagner plus de pièces ?"
- "C'est quoi une boucle for ?"

---

## 📁 Fichiers Créés/Modifiés

### Backend
- ✅ `backend/.env` (nouveau - à remplir avec votre clé)
- ✅ `backend/.gitignore` (nouveau - exclut .env)
- ✅ `backend/requirements.txt` (modifié - ajout de dépendances)
- ✅ `backend/app.py` (modifié - ajout endpoint /api/chat)
- ✅ `backend/knowledge_base.json` (nouveau)
- ✅ `backend/test_gemini.py` (nouveau)
- ✅ `backend/CHATBOT_SETUP.md` (nouveau)

### Frontend
- ✅ `game/chatbot.js` (modifié - appels à l'API réelle)

---

## 🔧 Personnalisation

### Modifier le ton du chatbot
Éditez `backend/app.py` dans la fonction `chat_with_gemini()`:
```python
prompt = f"""Tu es "GeniusBot", un assistant...
```
Changez les directives pour ajuster le ton.

### Ajouter de la connaissance
Éditez `backend/knowledge_base.json` et ajoutez des sections.
Le chatbot les utilisera automatiquement.

### Changer le modèle Gemini
Éditez `.env`:
```env
GEMINI_MODEL_NAME=gemini-2.5-flash  # Modèle rapide recommandé
# ou
GEMINI_MODEL_NAME=gemini-2.5-pro    # Version pro plus lente mais meilleure qualité
```

---

## 🐛 Dépannage

| Problème | Solution |
|----------|----------|
| "Chatbot IA non configuré" | Vérifiez que `.env` a la bonne clé API |
| "Erreur de connexion à l'IA" | Vérifiez que le serveur Flask est en cours d'exécution |
| Le chatbot ne répond pas | Exécutez `test_gemini.py` pour vérifier la configuration |
| Réponses lentes (>3s) | C'est normal, vérifiez votre connexion Internet |

---

## 📊 Prochaines Étapes (Optionnel)

1. **Historique conversationnel** : Ajouter la mémoire entre plusieurs questions
2. **Caching** : Mettre en cache les réponses fréquentes
3. **Analytics** : Tracker quelles questions les joueurs posent le plus
4. **Fine-tuning** : Créer un modèle Gemini spécialisé pour le jeu
5. **Multilingue** : Supporter plusieurs langues

---

## ❓ Questions?

- **Documention Gemini**: https://ai.google.dev/
- **Configuration Flask**: https://flask.palletsprojects.com/
- **CORS issue**: Déjà résolu avec `flask-cors`

Bon jeu! 🎮✨
