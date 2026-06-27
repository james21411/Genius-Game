import google.generativeai as genai
import os

api_key = os.environ.get('GEMINI_API_KEY', 'VOTRE_CLE_API_ICI')
if api_key == 'VOTRE_CLE_API_ICI':
    print("ERREUR: Pas de clé API configurée dans GEMINI_API_KEY")
else:
    genai.configure(api_key=api_key)
    print("Liste des modèles disponibles :")
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"- {m.name}")
