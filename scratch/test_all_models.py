import google.generativeai as genai
import os
import sys

api_key = os.environ.get('GEMINI_API_KEY', 'AIzaSyCOdhbViNV4LefjSatAbSozn9iAS-xKtOo')
genai.configure(api_key=api_key)

print(f"--- Test des modèles avec la clé API ---")
models = []
try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            models.append(m.name)
except Exception as e:
    print(f"Erreur lors du listage: {e}")
    sys.exit(1)

for model_name in models:
    print(f"Test de {model_name}...", end=" ", flush=True)
    try:
        model = genai.GenerativeModel(model_name)
        response = model.generate_content("Dis bonjour", generation_config={"max_output_tokens": 10})
        print("✅ SUCCÈS")
    except Exception as e:
        err_msg = str(e)
        if "403" in err_msg:
            print("❌ 403 (Accès refusé)")
        elif "404" in err_msg:
            print("❌ 404 (Non trouvé)")
        else:
            print(f"❌ ERREUR: {err_msg[:50]}...")

print("\n--- Fin du test ---")
