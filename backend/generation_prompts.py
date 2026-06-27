"""
Module: generation_prompts.py
Contient les prompts spécialisés pour générer les 7 types de questions supportés par le moteur de quiz.
"""

BLOOM_LABELS = {
    "knowledge": "Mémorisation",
    "comprehension": "Compréhension",
    "application": "Application",
    "analysis": "Analyse",
    "evaluation": "Évaluation",
    "creation": "Création",
}

SUPPORTED_TYPES = ("qcm", "tf", "short_answer", "matching", "dragdrop", "dragdrop_text", "dragdrop_image", "missing_words")


def _normalize_type(question_type):
    if question_type == "dragdrop_text":
        return "dragdrop"
    return question_type


def get_generation_prompt(context_text, num_questions, bloom_levels, question_type="qcm", extra_instructions=""):
    """
    Retourne le prompt complet adapté au type de question demandé.
    bloom_levels: str ou list de niveaux Bloom autorisés.
    """
    question_type = _normalize_type(question_type)

    if isinstance(bloom_levels, list):
        bloom_instruction = (
            f"- Niveaux Bloom autorisés : {', '.join(bloom_levels)}. "
            "Pour chaque question, choisis le niveau Bloom le plus adapté parmi cette liste."
        )
    else:
        bloom_instruction = f"- Niveau Bloom ciblé : {bloom_levels}"

    extra_block = ""
    if extra_instructions and extra_instructions.strip():
        extra_block = f"\nInstructions complémentaires de l'enseignant :\n{extra_instructions.strip()}\n"

    base_instructions = f"""
En tant qu'expert pédagogique, génère exactement {num_questions} questions éducatives à partir du support suivant :
\"\"\"{context_text}\"\"\"

Paramètres :
{bloom_instruction}
- Type de question : {question_type}
{extra_block}
Chaque question doit inclure une clé "points" (entier, généralement entre 1 et 5 selon la difficulté).

Réponds EXCLUSIVEMENT avec un tableau JSON valide. Ne mets pas de texte avant ou après le JSON.
"""

    type_specific_instructions = {
        "qcm": """
Chaque objet JSON DOIT avoir exactement les clés suivantes :
- "topic" (string) : Le thème court de la question
- "bloom_level" (string) : Le niveau Bloom utilisé
- "points" (integer) : Points attribués (ex: 1, 2, 3)
- "question" (string) : L'énoncé de la question
- "answer_a" (string) : Option A
- "answer_b" (string) : Option B
- "answer_c" (string) : Option C
- "answer_d" (string) : Option D
- "correct_answer" (string) : "A", "B", "C" ou "D"
- "explanation" (string) : Une explication pédagogique courte
""",
        "tf": """
Chaque objet JSON DOIT avoir exactement les clés suivantes :
- "topic" (string) : Le thème court
- "bloom_level" (string) : Le niveau Bloom
- "points" (integer) : Points attribués
- "question" (string) : L'affirmation à évaluer
- "correct_answer" (string) : "VRAI" ou "FAUX"
- "explanation" (string) : Une explication pédagogique courte justifiant le vrai/faux
""",
        "short_answer": """
Chaque objet JSON DOIT avoir exactement les clés suivantes :
- "topic" (string) : Le thème court
- "bloom_level" (string) : Le niveau Bloom
- "points" (integer) : Points attribués
- "question" (string) : L'énoncé (ex: "Quelle est la capitale de la France ?")
- "correct_answer" (string) : La réponse exacte attendue (ex: "Paris")
- "explanation" (string) : Une courte explication
""",
        "matching": """
Chaque objet JSON DOIT avoir exactement les clés suivantes :
- "topic" (string) : Le thème court
- "bloom_level" (string) : Le niveau Bloom
- "points" (integer) : Points attribués
- "question" (string) : Consigne (ex: "Associe les capitales à leur pays :")
- "extra_data" (object) : {"left_items": ["Paris", "Rome"], "right_items": ["France", "Italie"], "pairs": {"Paris": "France", "Rome": "Italie"}}
- "correct_answer" (string) : JSON stringifié des paires correctes
- "explanation" (string) : L'explication des associations
""",
        "dragdrop": """
Chaque objet JSON DOIT avoir exactement les clés suivantes :
- "topic" (string) : Le thème court
- "bloom_level" (string) : Le niveau Bloom
- "points" (integer) : Points attribués
- "question" (string) : Le texte à trous en utilisant {slot0}, {slot1}... (ex: "La capitale de la France est {slot0}.")
- "extra_data" (object) : {"choices": ["Paris", "Rome", "Londres"], "correct": ["Paris"]}
- "correct_answer" (string) : JSON stringifié du tableau ordonné des réponses attendues
- "explanation" (string) : Explication de la phrase complétée.
""",
        "dragdrop_image": """
Chaque objet JSON DOIT avoir exactement les clés suivantes :
- "topic" (string) : Le thème court
- "bloom_level" (string) : Le niveau Bloom
- "points" (integer) : Points attribués
- "question" (string) : Consigne (ex: "Place les étiquettes sur l'image :")
- "extra_data" (object) : {"image": "carte_france", "labels": ["Paris", "Lyon", "Marseille"], "slots": [{"x": 45, "y": 30, "label": "Paris"}, {"x": 55, "y": 60, "label": "Lyon"}]}
- "correct_answer" (string) : JSON stringifié des labels dans l'ordre des slots
- "explanation" (string) : Explication pédagogique.
Utilise "carte_france", "squelette" ou "systeme_solaire" comme valeur image si pertinent.
""",
        "missing_words": """
Chaque objet JSON DOIT avoir exactement les clés suivantes :
- "topic" (string) : Le thème court
- "bloom_level" (string) : Le niveau Bloom
- "points" (integer) : Points attribués
- "question" (string) : Le texte avec menus déroulants {select0}, {select1}... (ex: "L'eau bout à {select0} degrés.")
- "extra_data" (object) : {"dropdowns": [["0", "50", "100"], ["-10", "0", "10"]], "correct": ["100", "0"]}
- "correct_answer" (string) : JSON stringifié du tableau des réponses
- "explanation" (string) : Explication pédagogique.
""",
    }

    instructions = type_specific_instructions.get(question_type, type_specific_instructions["qcm"])
    return base_instructions + "\n" + instructions
