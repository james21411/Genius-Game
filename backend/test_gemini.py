#!/usr/bin/env python3
"""
Script de test pour vérifier la configuration de l'API Gemini
Exécutez: python test_gemini.py
"""

import os
import sys
import json
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

def test_gemini_configuration():
    """Teste la configuration de Gemini"""
    print("🧪 Test de configuration Gemini\n")
    
    # Test 1: Vérifier la clé API
    print("1️⃣  Vérification de la clé API...")
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        print("❌ GEMINI_API_KEY non définie dans .env")
        return False
    elif api_key == 'YOUR_GEMINI_API_KEY_HERE':
        print("⚠️  GEMINI_API_KEY est un placeholder - Remplacez-le par votre vraie clé")
        return False
    else:
        print(f"✅ Clé API détectée (première caractère: {api_key[0]}...)")
    
    # Test 2: Vérifier le modèle
    print("\n2️⃣  Vérification du modèle...")
    model_name = os.environ.get('GEMINI_MODEL_NAME', 'gemini-2.5-flash')
    print(f"✅ Modèle configuré: {model_name}")
    
    # Test 3: Charger la base de connaissance
    print("\n3️⃣  Vérification de la base de connaissance...")
    kb_path = 'knowledge_base.json'
    if os.path.exists(kb_path):
        try:
            with open(kb_path, 'r', encoding='utf-8') as f:
                kb = json.load(f)
            print(f"✅ Base de connaissance chargée ({len(kb)} sections)")
            for section in kb.keys():
                print(f"   - {section}")
        except Exception as e:
            print(f"❌ Erreur chargement base de connaissance: {e}")
            return False
    else:
        print(f"⚠️  Base de connaissance non trouvée à: {kb_path}")
    
    # Test 4: Tester la connexion Gemini (optionnel)
    print("\n4️⃣  Test de connexion Gemini API...")
    try:
        import google.generativeai as genai
        
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)
        
        # Test simple
        response = model.generate_content("Dis 'Test réussi!' en une phrase courte.")
        if response.text:
            print(f"✅ Connexion Gemini réussie")
            print(f"   Réponse: {response.text[:100]}")
        else:
            print("❌ Réponse vide de Gemini")
            return False
    except ImportError:
        print("⚠️  google-generativeai non installé")
        print("   Installez avec: pip install -r requirements.txt")
        return False
    except Exception as e:
        print(f"❌ Erreur connexion Gemini: {e}")
        return False
    
    print("\n" + "="*50)
    print("✅ Tous les tests sont passés!")
    print("="*50)
    print("\n🚀 Vous pouvez maintenant démarrer le serveur:")
    print("   python app.py")
    return True

if __name__ == '__main__':
    success = test_gemini_configuration()
    sys.exit(0 if success else 1)
