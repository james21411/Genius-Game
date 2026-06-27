"""
Module: student_analyzer.py
Analyse les performances d'un élève pour fournir un profil cognitif à l'agent IA.
"""

import sqlite3

def get_student_profile(db_conn, student_id, class_id=None):
    """
    Extrait les statistiques de l'élève pour construire son profil cognitif.
    """
    profile = {
        "success_rate": 0,
        "total_answered": 0,
        "weak_topics": [],
        "strong_topics": [],
        "recent_errors": []
    }
    
    try:
        # 1. Taux de réussite global
        res = db_conn.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct
            FROM answers
            WHERE student_id = ?
        """, (student_id,)).fetchone()
        
        if res and res['total'] > 0:
            profile['total_answered'] = res['total']
            profile['success_rate'] = round((res['correct'] or 0) / res['total'] * 100)
            
        # 2. Analyse par sujet/topic
        topics = db_conn.execute("""
            SELECT 
                q.topic,
                COUNT(*) as total,
                CAST(SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) as success_ratio
            FROM answers a
            JOIN questions q ON a.question_id = q.id
            WHERE a.student_id = ?
            GROUP BY q.topic
            HAVING total >= 3
        """, (student_id,)).fetchall()
        
        for t in topics:
            if t['success_ratio'] < 0.5:
                profile['weak_topics'].append(t['topic'])
            elif t['success_ratio'] >= 0.8:
                profile['strong_topics'].append(t['topic'])
                
        # 3. Dernières erreurs
        errors = db_conn.execute("""
            SELECT q.question, q.topic
            FROM answers a
            JOIN questions q ON a.question_id = q.id
            WHERE a.student_id = ? AND a.is_correct = 0
            ORDER BY a.answered_at DESC
            LIMIT 3
        """, (student_id,)).fetchall()
        
        profile['recent_errors'] = [{"question": e['question'], "topic": e['topic']} for e in errors]
        
    except Exception as e:
        print(f"Erreur lors de l'analyse du profil élève {student_id}: {e}")
        
    return profile
