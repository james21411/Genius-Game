# 🎓 Genius Jump EDU — Plan de Transformation Éducative
### Hackathon — Plan Ultra-Détaillé

---

## 🎯 Vision Globale

Transformer **Genius Jump** (platformer JS existant) en un **jeu éducatif adaptatif multi-matières** où :
- L'apprentissage **EST** le gameplay (pas un add-on)
- L'enseignant configure tout sans coder
- Les élèves apprennent en jouant ET sont évalués
- Le système s'adapte à n'importe quelle matière / niveau

**Modèle d'inspiration :** Prodigy Math (RPG + math intégré) + Duolingo (boucle de répétition) + Kahoot (engagement social)

---

## 🏗️ Architecture Générale

```
┌─────────────────────────────────────────────────────┐
│                  GENIUS JUMP EDU                    │
├──────────────┬──────────────────┬───────────────────┤
│  PANEL PROF  │   JEUX ÉLÈVE     │  BASE DE DONNÉES  │
│  (Dashboard) │   (Platformer)   │  (localStorage /  │
│              │                  │   JSON export)    │
│ • Config     │ • Mode Leçon     │                   │
│   contenu    │ • Mode Éval      │ • Sessions        │
│ • Stats      │ • Mode Libre     │ • Scores          │
│ • Classes    │                  │ • Questions       │
└──────────────┴──────────────────┴───────────────────┘
```

---

## 📐 PARTIE 1 — SYSTÈME DE CONTENU ÉDUCATIF (ContentEngine)

### 1.1 — Structure d'une Question

Chaque question est un objet JSON configurable par l'enseignant :

```json
{
  "id": "q_math_001",
  "subject": "Mathématiques",
  "topic": "Multiplication",
  "level": 1,
  "type": "qcm",
  "question": "Combien font 7 × 8 ?",
  "answers": ["54", "56", "63", "48"],
  "correct": 1,
  "explanation": "7 × 8 = 56. Astuce : 7×8 = 7×4×2 = 28×2",
  "bloomLevel": "knowledge",
  "timeLimit": 15,
  "xpReward": 50,
  "difficulty": 1
}
```

### 1.2 — Types de Questions Supportés

| Type | Description | Intégration Gameplay |
|------|-------------|---------------------|
| `qcm` | 4 choix (A/B/C/D) | Plateformes = réponses à sauter dessus |
| `vrai_faux` | Oui ou Non | 2 plateformes côte à côte |
| `texte_libre` | Saisie clavier | Panneau flottant + pause jeu |
| `glisser_deposer` | Associer colonnes | Mini-puzzle interactif |
| `ordre` | Remettre dans l'ordre | Séquence de plateformes numérotées |
| `calcul` | Saisir un résultat numérique | Clavier numérique HUD |

### 1.3 — Taxonomie de Bloom Intégrée

Le système suit les 6 niveaux de Bloom pour garantir une progression pédagogique :

| Niveau Bloom | Type de Q dans le jeu | Récompense XP |
|---|---|---|
| 1. Mémorisation | QCM simple | 50 XP |
| 2. Compréhension | Expliquer dans ses mots | 80 XP |
| 3. Application | Résoudre un problème | 120 XP |
| 4. Analyse | Trouver l'erreur | 160 XP |
| 5. Évaluation | Choisir la meilleure stratégie | 200 XP |
| 6. Création | Construire une réponse | 250 XP |

---

## 📐 PARTIE 2 — INTÉGRATION AU GAMEPLAY (La Clé du Succès)

> **Principe fondamental :** La question n'interrompt PAS le jeu — elle EN EST la mécanique.

### 2.1 — Mode LEÇON : "Learn & Jump"

#### Mécanisme des Plateformes-Questions

```
Niveau du monde = 1 Village = 1 Thème de cours

Village 1 : Les fractions (Math CE2)
  Plateforme 1 → Question d'introduction (Bloom 1)
  Plateforme 2 → Question de compréhension (Bloom 2)
  Plateforme 3 → Leçon animée (carte de connaissance)
  Plateforme 4 → Application (Bloom 3)
  Boss du village → Question de synthèse + mini-défi
```

#### Comment ça fonctionne dans le moteur actuel :

**Nouveau type de plateforme : `quiz_platform`**

Quand le joueur **atterrit** sur une plateforme-quiz :
1. Le jeu **ralentit** (temps divisé par 4) — PAS de pause brutale
2. Une **carte de question** émerge du sol avec animation
3. Les **4 réponses deviennent des plateformes colorées** au-dessus
4. Le joueur **saute sur la bonne réponse** pour valider
5. **Bonne réponse** → explosion de confettis + gain XP + plateforme devient dorée → continue
6. **Mauvaise réponse** → tremblement + explication animée + réessai (2 tentatives max)
7. Après 2 échecs → explication automatique + joker offert (pas de malus sur la vie)

#### Carte de Connaissance (avant la question)

Pour les nouvelles notions, une **"Leçon Flash"** de 10-15 secondes s'affiche :
- Texte illustré + icône
- L'élève peut la relire ou passer
- Elle est mémorisée et accessible via le menu Inventaire

### 2.2 — Mode ÉVALUATION : "Challenge Run"

- Même monde, mêmes plateformes, MAIS :
  - Pas d'explications avant
  - Timer par question activé
  - Pas de 2e chance
  - Le score compte pour les stats du prof
  - L'élève voit son résultat à la fin avec le classement classe

### 2.3 — Mode LIBRE (après avoir validé la leçon)

- Le monde est débloqué, plus de questions obligatoires
- Des **bonus cognitifs** apparaissent (questions bonus = XP supplémentaire)
- L'élève peut rejouer pour améliorer son score

### 2.4 — Intégration Bosses → Évaluation Finale

Les **boss existants** deviennent des **Boss-Quizz** :
- Chaque coup sur le boss = 1 question à répondre correctement
- Bonne réponse → le projectile du joueur fait des dégâts
- Mauvaise réponse → le boss regagne de la vie
- Le boss final du monde = évaluation sommative de toute la leçon

---

## 📐 PARTIE 3 — SYSTÈME D'XP ET DE PROGRESSION

### 3.1 — Monnaie Éducative (remplace les coins)

| Objet actuel | Objet éducatif | Obtenu comment |
|---|---|---|
| Coins 🪙 | Points Savoir ⭐ | Bonnes réponses |
| Cœurs ❤️ | Vies (inchangé) | Ramasser / bonus |
| Balles 🔫 | Éclairs 💡 | Répondre vite |

### 3.2 — Système de Niveaux Élève

```
Niveau 1 : Apprenti   (0 - 500 XP)
Niveau 2 : Explorateur (500 - 1500 XP)
Niveau 3 : Savant      (1500 - 3500 XP)
Niveau 4 : Expert      (3500 - 7000 XP)
Niveau 5 : Génie       (7000+ XP)
```

Chaque niveau débloque :
- Un nouveau skin pour le personnage
- Un nouvel environnement visuel
- Une médaille sur le tableau de bord prof

### 3.3 — Badges et Récompenses

| Badge | Condition |
|---|---|
| 🔥 En Feu | 5 bonnes réponses consécutives |
| ⚡ Éclair | Répondre en moins de 3s |
| 🧠 Cerveau d'Or | 100% sur une évaluation |
| 🎯 Précis | Jamais de mauvaise réponse en mode leçon |
| 🏆 Maître | Terminer tous les villages d'un monde |

---

## 📐 PARTIE 4 — PANEL ENSEIGNANT

### 4.1 — Interface de Configuration

#### Écran 1 : Gestion des Classes

```
┌─────────────────────────────────────────┐
│  MES CLASSES                 [+ Créer] │
├─────────────────────────────────────────┤
│  🏫 CM2-A  (25 élèves)  [Gérer] [📊]  │
│  🏫 CE2-B  (22 élèves)  [Gérer] [📊]  │
│  🏫 6ème-C (28 élèves)  [Gérer] [📊]  │
└─────────────────────────────────────────┘
```

#### Écran 2 : Configuration d'un Monde

```
┌─────────────────────────────────────────┐
│  MONDE 1 — Configuration               │
├─────────────────────────────────────────┤
│  Matière : [Mathématiques ▼]           │
│  Thème   : [Les Fractions   ▼]         │
│  Niveau  : [CE2 ▼]                     │
│  Mode    : [○ Leçon  ● Évaluation]     │
├─────────────────────────────────────────┤
│  QUESTIONS (12 / 20 configurées)        │
│  [+ Ajouter]  [📥 Importer CSV]        │
│                                         │
│  Q1: "Que vaut 1/2 + 1/4 ?" ✏️ 🗑️    │
│  Q2: "Quel est le numérateur ?" ✏️ 🗑️ │
│  ...                                    │
├─────────────────────────────────────────┤
│  [💾 Sauvegarder]  [▶ Activer]         │
└─────────────────────────────────────────┘
```

#### Écran 3 : Éditeur de Question

```
┌─────────────────────────────────────────┐
│  NOUVELLE QUESTION                      │
├─────────────────────────────────────────┤
│  Type : [QCM ▼]                        │
│  Bloom: [Compréhension ▼]              │
│                                         │
│  Question :                             │
│  [Quel est le dénominateur de 3/4 ?___]│
│                                         │
│  Réponse A : [3] ○ correcte            │
│  Réponse B : [4] ● correcte            │
│  Réponse C : [7] ○ correcte            │
│  Réponse D : [12]○ correcte            │
│                                         │
│  Explication :                          │
│  [Le dénominateur est sous la barre...] │
│                                         │
│  Temps limite : [15] secondes           │
│  XP           : [80]                    │
├─────────────────────────────────────────┤
│  [Prévisualiser]      [💾 Enregistrer] │
└─────────────────────────────────────────┘
```

### 4.2 — Import de Contenu

L'enseignant peut importer ses questions via **CSV** :

```csv
question,type,answer_a,answer_b,answer_c,answer_d,correct,explanation,bloom,xp
"7×8=?",qcm,54,56,63,48,B,"7×8=56",knowledge,50
"Capitale de France?",qcm,Lyon,Paris,Marseille,Bordeaux,B,"Paris est la capitale",knowledge,50
```

Ou via **JSON** pour les enseignants avancés.

### 4.3 — Bibliothèque de Contenu Partagé

- L'enseignant peut publier ses quiz dans une bibliothèque partagée
- Accessible en lecture seule aux autres enseignants
- Filtrage par matière / niveau / langue

---

## 📐 PARTIE 5 — TABLEAU DE BORD ANALYTIQUE

### 5.1 — Vue Globale Classe

```
┌──────────────────────────────────────────────┐
│  📊 CLASSE CM2-A — Session du 10/05/2026    │
├──────────┬───────────┬──────────┬────────────┤
│ Élève    │ Score (%) │ Temps    │ Difficultés│
├──────────┼───────────┼──────────┼────────────┤
│ Alice    │  92%  ⭐  │ 18 min   │ Aucune     │
│ Bruno    │  65%  ⚠️  │ 25 min   │ Q3, Q7, Q11│
│ Camille  │  78%      │ 22 min   │ Q7, Q11    │
│ David    │  45%  🔴  │ 30 min   │ Q3,Q7,Q9.. │
├──────────┴───────────┴──────────┴────────────┤
│ Moyenne classe : 71% │ Taux completion : 89% │
└──────────────────────────────────────────────┘
```

### 5.2 — Carte Thermique des Difficultés

Visualisation par question : quelles questions ont posé problème ?

```
Q1  ████████████████████ 95% réussite   ✅
Q2  ████████████████░░░░ 80% réussite   ✅
Q3  ████████░░░░░░░░░░░░ 40% réussite   ⚠️ RÉVISER
Q4  ███████████████████░ 90% réussite   ✅
Q7  ██████░░░░░░░░░░░░░░ 30% réussite   🔴 CRITIQUE
Q11 ████████░░░░░░░░░░░░ 38% réussite   ⚠️ RÉVISER
```

→ Le prof voit immédiatement : **"Q7 et Q11 nécessitent une reprise en classe"**

### 5.3 — Profil Individuel Élève

```
┌──────────────────────────────────────┐
│  👤 Bruno Martin                    │
│  Niveau : Explorateur ⭐⭐           │
│  XP Total : 1240                    │
├──────────────────────────────────────┤
│  POINTS FORTS                       │
│  ✅ Additions (95%)                 │
│  ✅ Géographie (88%)               │
│                                      │
│  POINTS FAIBLES                     │
│  ❌ Fractions (42%) → Q3, Q7       │
│  ❌ Divisions (38%)                │
│                                      │
│  ÉVOLUTION                          │
│  Semaine 1: 55% → Semaine 2: 65%   │
│  📈 +10% — Progression positive !  │
├──────────────────────────────────────┤
│  Temps moyen / question : 18s       │
│  (Classe: 14s) → Besoin de soutien │
└──────────────────────────────────────┘
```

### 5.4 — Alertes Automatiques

Le système génère des alertes proactives :
- 🔴 **Alerte critique** : Élève < 40% sur 2 sessions consécutives
- ⚠️ **Alerte attention** : Question ratée par > 60% de la classe
- 📈 **Alerte positive** : Élève +20% en une semaine (à féliciter)

---

## 📐 PARTIE 6 — SYSTÈME D'ADAPTATION (IA Pédagogique)

### 6.1 — Difficulté Adaptive

Le jeu ajuste la difficulté en temps réel :

```
Performance > 85% pendant 3 questions → niveau +1 (questions Bloom suivant)
Performance < 50% pendant 2 questions → niveau -1 + répétition de la notion
Performance < 30% → affichage Leçon Flash + questions de niveau 1
```

### 6.2 — Répétition Espacée (Spaced Repetition)

Inspiré de Duolingo/Anki :
- Une question ratée est **reprogrammée** dans 1 session
- Une question réussie une fois → reprogrammée dans 3 sessions
- Une question réussie 3 fois → archivée (maîtrisée)

Le jeu génère automatiquement des **"sessions de révision"** pour les notions fragiles.

---

## 📐 PARTIE 7 — IMPLÉMENTATION TECHNIQUE

### 7.1 — Nouveaux Fichiers à Créer

```
PROJET_HACKATHON/
├── game/
│   ├── engine.js          (MODIFIER — intégrer quiz_platform + slowmo)
│   ├── level.js           (MODIFIER — quiz_platform type, worlds par matière)
│   ├── render.js          (MODIFIER — afficher overlay question)
│   ├── quiz_engine.js     (NOUVEAU — logique des questions)
│   ├── content_store.js   (NOUVEAU — stockage JSON des questions)
│   ├── analytics.js       (NOUVEAU — tracking sessions élèves)
│   └── edu_hud.js         (NOUVEAU — HUD éducatif : XP, badges, progress)
├── dashboard/
│   ├── index.html         (NOUVEAU — panel enseignant)
│   ├── dashboard.js       (NOUVEAU — logique dashboard)
│   └── dashboard.css      (NOUVEAU — style dashboard)
├── data/
│   ├── default_content.json (NOUVEAU — 50 questions par défaut multi-matières)
│   └── sessions/           (NOUVEAU — données élèves)
├── index.html             (MODIFIER — ajouter lien dashboard + code élève)
└── main.js               (MODIFIER — intégrer quiz_engine au démarrage)
```

### 7.2 — Modifications Engine.js

**Ajouter dans la boucle de jeu :**

```javascript
// Nouvelle logique : plateforme quiz
if (player.grounded && currentPlatform?.type === 'quiz_platform') {
  if (!currentPlatform.answered) {
    triggerQuizMode(currentPlatform.questionId);
  }
}

// SlowMo pendant quiz
if (window.quizActive) {
  dt *= 0.1; // ralentissement du temps
}
```

### 7.3 — quiz_engine.js (Nouveau Module)

```javascript
// Responsabilités :
// 1. Charger les questions depuis content_store
// 2. Afficher l'overlay de question sur le canvas
// 3. Gérer les réponses (QCM = plateformes cliquables)
// 4. Appliquer le système de scoring
// 5. Envoyer les résultats à analytics.js
// 6. Gérer le mode adaptive (changer Bloom level)

export function triggerQuizMode(questionId) { ... }
export function resolveAnswer(answerId) { ... }
export function showExplanation(question) { ... }
export function nextQuestion() { ... }
```

### 7.4 — content_store.js (Nouveau Module)

```javascript
// Stockage des questions dans localStorage
// Format : { classId, worldId, questions[] }
// Fonctions :
export function loadContent(classId) { ... }
export function saveContent(classId, content) { ... }
export function importFromCSV(csvText) { ... }
export function exportToJSON(classId) { ... }
export function getQuestionsForLevel(worldId, bloomLevel) { ... }
```

### 7.5 — analytics.js (Nouveau Module)

```javascript
// Tracking des sessions élèves
export function startSession(studentId, classId, worldId) { ... }
export function recordAnswer(questionId, isCorrect, timeTaken) { ... }
export function endSession() { ... }
export function getClassStats(classId) { ... }
export function getStudentProfile(studentId) { ... }
export function exportReport(classId) { ... }
```

### 7.6 — Connexion Élève (sans serveur)

Système simple pour le hackathon :
- L'enseignant génère un **code de classe** (ex: `CM2A-2026`)
- L'élève entre le code sur la page d'accueil
- Les données sont stockées en **localStorage** (avec export JSON)
- Pour le hackathon : pas besoin de backend

---

## 📐 PARTIE 8 — CONTENU PAR DÉFAUT (50 Questions)

### Matières & Thèmes Inclus

| Matière | Thèmes | Nb Questions |
|---|---|---|
| Mathématiques | Tables, Fractions, Géométrie | 15 |
| Français | Conjugaison, Grammaire, Vocabulaire | 15 |
| Sciences | Corps humain, Nature, Physique | 10 |
| Histoire-Géo | France, Europe, Chronologie | 10 |

**Total : 50 questions multi-niveaux (CE2 → 6ème)**

---

## 📐 PARTIE 9 — EXPÉRIENCE UTILISATEUR COMPLÈTE

### 9.1 — Parcours Élève (de A à Z)

```
1. Élève arrive sur index.html
2. Entre le code de classe fourni par le prof
3. Entre son prénom
4. Choisit un avatar personnalisé
5. Tutoriel interactif (30s) : "Saute sur la bonne réponse !"
6. Lance le Monde 1 (configuré par le prof)
7. Joue et apprend → questions intégrées aux plateformes
8. Termine le monde → écran de résultats + badges
9. Stats envoyées au tableau de bord du prof
```

### 9.2 — Parcours Enseignant (de A à Z)

```
1. Accède à dashboard/index.html
2. Crée sa classe + génère le code
3. Configure le Monde 1 :
   - Choisit la matière et le thème
   - Ajoute/importe ses questions
   - Choisit mode Leçon ou Évaluation
   - Règle la difficulté initiale
4. Partage le code avec les élèves
5. Pendant la session : voit les stats en temps réel
6. Après la session : analyse la carte thermique
7. Identifie les notions à reprendre en classe
8. Replanifie une session ciblée
```

---

## 📐 PARTIE 10 — ÉLÉMENTS VISUELS ÉDUCATIFS

### 10.1 — Nouveaux Assets Visuels Nécessaires

| Asset | Description | Usage |
|---|---|---|
| `quiz_platform.png` | Plateforme dorée avec point d'interrogation | Platforme-quiz |
| `answer_card.png` | Carte de question flottante | Overlay question |
| `xp_orb.png` | Orbe d'XP colorée | Récompense réponse correcte |
| `badge_*.png` | 5 badges distincts | Achievements |
| `boss_quiz_aura.png` | Aura violette sur les boss | Boss quizz |

### 10.2 — Effets Visuels Ajoutés

| Événement | Effet |
|---|---|
| Bonne réponse | Confettis dorés + flash vert + son "ding" |
| Mauvaise réponse | Tremblement + flash rouge + son "bzzt" |
| Boss vaincu | Explosion étoiles + fanfare |
| Badge obtenu | Animation de badge montant du bas |
| Level up | Écran de célébration 3s |

---

## 📐 PARTIE 11 — PLAN D'IMPLÉMENTATION PAR PHASES

### Phase 1 : Fondation (Jour 1 — 4h)
- [ ] Créer `content_store.js` avec 20 questions par défaut
- [ ] Modifier `level.js` pour ajouter `quiz_platform` comme type
- [ ] Modifier `engine.js` pour détecter l'atterrissage sur quiz_platform
- [ ] Créer `quiz_engine.js` avec overlay QCM basique

### Phase 2 : Gameplay Éducatif (Jour 1 — 4h)
- [ ] Intégrer l'overlay question dans `render.js`
- [ ] Implémenter les 4 plateformes-réponses
- [ ] Système SlowMo pendant quiz
- [ ] XP et badges dans `edu_hud.js`
- [ ] Explications après chaque réponse

### Phase 3 : Panel Enseignant (Jour 2 — 4h)
- [ ] Créer `dashboard/index.html` avec éditeur de questions
- [ ] Import CSV
- [ ] Gestion des classes + code d'accès
- [ ] Sauvegarder dans localStorage

### Phase 4 : Analytique (Jour 2 — 3h)
- [ ] `analytics.js` : enregistrer chaque réponse
- [ ] Tableau de bord avec carte thermique
- [ ] Profil élève individuel
- [ ] Export rapport PDF (ou JSON)

### Phase 5 : Polish (Jour 3 — 3h)
- [ ] Boss quizz complet
- [ ] Effets visuels et sons
- [ ] Difficulté adaptive
- [ ] Tutoriel interactif
- [ ] Tests complets avec vraies questions

---

## 🔑 Questions Ouvertes pour l'Équipe

> [!IMPORTANT]
> **Stockage** : On reste sur `localStorage` pour le hackathon ou on monte un mini-backend (Node.js) ? Le localStorage limite à 1 navigateur par machine.

> [!IMPORTANT]
> **Multi-joueurs** : Est-ce qu'on veut un mode classe en temps réel (tous les élèves jouent en même temps, classement live type Kahoot) ? C'est une fonctionnalité WOW pour le jury.

> [!WARNING]
> **Assets visuels** : Les nouveaux types de plateformes (quiz_platform, boss_quiz) nécessitent de nouveaux sprites. On génère avec l'IA ou on utilise des CSS/canvas purs pour aller plus vite ?

> [!NOTE]
> **Matière par défaut** : Avec quel sujet on démo au hackathon ? Mathématiques (tables, fractions) est le plus universel et impressionnant visuellement.
