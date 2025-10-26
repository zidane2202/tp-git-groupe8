import os
import sys
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from google import genai

# --- Configuration ---
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
SMTP_PASS = os.environ.get("SMTP_PASS")
SMTP_USER = os.environ.get("SMTP_USER")

if len(sys.argv) < 3:
    print("Erreur: L'email du destinataire et la liste des fichiers modifiés sont requis.")
    sys.exit(1)

RECIPIENT_EMAIL = sys.argv[1]
CHANGED_FILES = sys.argv[2].split()

# --- Fonctions d'aide ---

def get_file_content(file_path):
    """Lit le contenu d'un fichier (jusqu'à 100 lignes)."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = "".join(f.readlines()[:100])
        return f"--- Contenu du fichier: {file_path} ---\n{content}\n"
    except Exception as e:
        return f"--- Impossible de lire le fichier: {file_path} (Erreur: {e}) ---\n"

def generate_prompt(changed_files):
    """Génère le prompt pour l'IA avec le contenu des fichiers."""
    prompt = """
    Vous êtes un expert senior en revue de code. Analysez les fichiers modifiés fournis ci-dessous.
    
    Instructions spécifiques:
    1. Examinez le code pour:
       - Bugs et erreurs potentiels
       - Problèmes de sécurité
       - Performances
       - Lisibilité et maintenabilité
       - Cohérence avec les bonnes pratiques
    
    2. Format de réponse (HTML):
       <h1>📊 Revue de Code - [Succès/Attention]</h1>
       
       <h2>🎯 Résumé</h2>
       [Vue d'ensemble concise des changements]
       
       <h2>🔍 Analyse par Fichier</h2>
       [Pour chaque fichier modifié]
       
       <h2>⚠️ Problèmes Détectés</h2>
       [Si applicable, sinon section omise]
       
       <h2>💡 Suggestions d'Amélioration</h2>
       [Recommandations concrètes]
    
    Ne générez pas d'exemple - analysez uniquement le code fourni.
    Soyez précis dans vos retours avec les numéros de ligne.
    
    --- Fichiers Modifiés ---
    """
    
    for file in changed_files:
        if file.startswith('.github/') or file.endswith(('.png', '.jpg', '.gif', '.bin')):
            continue
        prompt += f"\n\n=== {file} ===\n"
        prompt += get_file_content(file)
    
    return prompt

def get_ai_review(prompt):
    """Appelle l'API Gemini pour obtenir la revue HTML."""
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        html_content = response.text.strip()
        if html_content.startswith("```html"):
            html_content = html_content.strip("```html").strip("```").strip()
        return html_content
    except Exception as e:
        return f"<h1>Erreur d'API Gemini</h1><p>Impossible d'obtenir la revue de code. Erreur: {e}</p>"

def send_email(recipient, subject, html_body):
    """Envoie l'email HTML via SMTP (Gmail)."""
    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = SMTP_USER
        msg['To'] = recipient
        msg['Subject'] = subject
        msg.attach(MIMEText(html_body, 'html'))

        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        server.ehlo()
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_USER, recipient, msg.as_string())
        server.close()
        print(f"Succès: Email envoyé à {recipient}")
    except Exception as e:
        print(f"Erreur: Échec de l'envoi de l'email à {recipient}. Erreur: {e}")
        print("\n--- Contenu HTML non envoyé (pour débogage) ---\n")
        print(html_body)
        print("\n----------------------------------------------------\n")

# --- Logique principale ---
print(f"Début de l'analyse pour le push de: {RECIPIENT_EMAIL}")
print(f"Fichiers modifiés: {', '.join(CHANGED_FILES)}")

# 1. Générer le prompt
review_prompt = generate_prompt(CHANGED_FILES)

# 2. Obtenir la revue IA
html_review = get_ai_review(review_prompt)

# 3. Détecter les erreurs et leur gravité dans le code
def analyze_review(html_content):
    error_patterns = {
        'critical': ['erreur critique', 'bug majeur', 'faille de sécurité', 'crash'],
        'warning': ['warning', 'attention', 'à améliorer', 'pourrait causer'],
        'info': ['suggestion', 'amélioration possible', 'considérer']
    }
    
    found_issues = {'critical': [], 'warning': [], 'info': []}
    content_lower = html_content.lower()
    
    for level, patterns in error_patterns.items():
        for pattern in patterns:
            if pattern in content_lower:
                found_issues[level].append(pattern)
    
    return found_issues

issues = analyze_review(html_review)
errors_detected = bool(issues['critical'] or issues['warning'])

# 4. Déterminer le sujet de l'email
if issues['critical']:
    email_subject = "🚨 Revue de Code - Erreurs Critiques Détectées"
elif issues['warning']:
    email_subject = "⚠️ Revue de Code - Avertissements à Corriger"
else:
    email_subject = "✅ Revue de Code - Code Validé"

# 5. Envoyer l'email
send_email(RECIPIENT_EMAIL, email_subject, html_review)

# 6. Faire échouer le push si erreurs détectées
if errors_detected:
    print("Des erreurs ont été détectées dans le code. Le push va échouer.")
    sys.exit(1)
else:
    print("Le code est valide. Le push peut continuer.")
