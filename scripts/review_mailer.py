import os
import sys
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from google import genai
import subprocess

# --- Configuration ---
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL")

if len(sys.argv) < 2:
    print("Erreur: L'email du destinataire est requis.")
    sys.exit(1)

RECIPIENT_EMAIL = sys.argv[1]

# --- Fonctions ---
def get_changed_files():
    """Récupère la liste des fichiers modifiés dans le dernier commit."""
    result = subprocess.check_output(
        ['git', 'diff', '--name-only', 'HEAD~1', 'HEAD'],
        text=True
    )
    return [f for f in result.strip().splitlines() if f]

def get_file_content(file_path, commit_hash=None):
    """Lit le contenu d'un fichier actuel ou à un commit précédent (max 200 lignes)."""
    if file_path.startswith('.github/') or file_path.endswith(('.png', '.jpg', '.gif', '.bin')):
        return None

    try:
        if commit_hash:
            content = subprocess.check_output(
                ['git', 'show', f'{commit_hash}:{file_path}'],
                text=True, errors='ignore'
            )
        else:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = "".join(f.readlines()[:200])
        return f"--- Contenu de {file_path}" + (f" à {commit_hash}" if commit_hash else "") + f" ---\n{content}\n"
    except Exception as e:
        return f"--- Impossible de lire {file_path}" + (f" à {commit_hash}" if commit_hash else "") + f": {e} ---\n"

def generate_prompt(changed_files):
    """Crée un prompt pour l'IA afin de générer un email HTML complet."""
    files_content = ""
    for file in changed_files:
        # Version actuelle
        content_current = get_file_content(file)
        if content_current:
            files_content += content_current
        # Version précédente (HEAD~1)
        content_prev = get_file_content(file, 'HEAD~1')
        if content_prev:
            files_content += content_prev

    prompt = f"""
Vous êtes un expert en revue de code. Analysez les fichiers suivants et identifiez toutes les erreurs HTML, CSS et JavaScript, 
y compris celles provenant de commits plus anciens.

Contenu des fichiers :
{files_content}

Instructions pour l'email à générer :
1. Toujours produire un HTML complet (<html>, <body>) avec styles en ligne.
2. Ne jamais utiliser Markdown ou balises ``` ou ##.
3. Titre principal : "Revue de Code - Code validé" (vert) si aucun problème,
   ou "Revue de Code - Erreurs détectées" (rouge) si des erreurs sont trouvées.
4. Message d’introduction expliquant que la revue a été effectuée.
5. Pour chaque fichier avec des erreurs, détailler :
   - Nom du fichier
   - Description de l'erreur
   - Extrait de code impacté
   - Correction suggérée
6. Ajouter une section "Suggestions IA pour l'amélioration du code".
7. Style :
   - Boîte centrale blanche avec bord arrondi et ombre douce
   - Fond gris clair (#f4f4f9)
   - Police Arial ou sans-serif
   - Titres colorés selon importance
   - Séparateurs <hr> entre sections
8. Signature : "Cordialement, L'équipe de Revue de Code"
"""
    return prompt

def get_ai_review(prompt):
    """Appelle l'API Gemini pour obtenir l'email HTML."""
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
    """Envoie l'email HTML via SMTP Gmail."""
    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = SENDER_EMAIL
        msg['To'] = recipient
        msg['Subject'] = subject
        msg.attach(MIMEText(html_body, 'html'))

        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        server.ehlo()
        server.login(SENDER_EMAIL, GMAIL_APP_PASSWORD)
        server.sendmail(SENDER_EMAIL, recipient, msg.as_string())
        server.close()

        print(f"Succès: Email de revue de code envoyé à {recipient}")
    except Exception as e:
        print(f"Erreur: Échec de l'envoi de l'email à {recipient}. Erreur: {e}")
        print("\n--- Contenu HTML pour débogage ---\n")
        print(html_body)
        print("\n----------------------------------------------------\n")

# --- Logique principale ---
CHANGED_FILES = get_changed_files()
print(f"Début de l'analyse pour le push de: {RECIPIENT_EMAIL}")
print(f"Fichiers modifiés: {', '.join(CHANGED_FILES)}")

review_prompt = generate_prompt(CHANGED_FILES)
html_review = get_ai_review(review_prompt)

# Détecter si des erreurs existent dans la réponse
if "Erreurs détectées" in html_review:
    exit_code = 1
    mail_subject = "⚠️ Revue de Code - Erreurs détectées"
else:
    exit_code = 0
    mail_subject = "✅ Revue de Code - Code validé"

# Envoi de l'email
send_email(RECIPIENT_EMAIL, mail_subject, html_review)

# Faire échouer le push si des erreurs détectées
sys.exit(exit_code)
