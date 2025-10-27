import os
import sys
import subprocess
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from bs4 import BeautifulSoup
from google import genai

# --- Configuration ---
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL")

if len(sys.argv) < 2:
    print("Erreur: L'email du destinataire est requis.")
    sys.exit(1)

RECIPIENT_EMAIL = sys.argv[1]

# --- Fonctions Git ---
def get_all_tracked_files():
    """Retourne tous les fichiers suivis par Git."""
    result = subprocess.run(["git", "ls-files"], capture_output=True, text=True)
    return result.stdout.splitlines()

def filter_code_files(files):
    """Filtre les fichiers pertinents pour la revue de code."""
    return [
        f for f in files
        if not f.startswith('.github/') and not f.endswith(('.png', '.jpg', '.gif', '.bin'))
    ]

# --- Fonctions pour le contenu des fichiers ---
def get_file_content(file_path):
    """Lit le contenu d'un fichier (limité aux 100 premières lignes)."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = "".join(f.readlines()[:100])
        return f"--- Contenu du fichier: {file_path} ---\n{content}\n"
    except Exception as e:
        return f"--- Impossible de lire le fichier: {file_path} (Erreur: {e}) ---\n"

def get_all_files_content(files):
    content = ""
    for file in files:
        content += get_file_content(file)
    return content

# --- Fonctions IA ---
def generate_prompt(files_content):
    """Génère le prompt pour l'IA avec instructions HTML dynamiques."""
    prompt = f"""
Vous êtes un expert en revue de code. Analysez TOUS les fichiers du dépôt et générez un email complet en HTML pour le développeur.
Incluez :
- Erreurs détectées (en rouge)
- Suggestions d'amélioration (titre bleu, texte gris foncé)
- Sections claires séparées par <hr>
- Boîte centrale blanche, bord arrondi, ombre douce
- Police Arial ou sans-serif
- Fond général gris clair (#f4f4f9)
- CSS en ligne uniquement
- HTML complet (<html>, <body>, etc.)
- Si aucun problème, félicitez le développeur et proposez des améliorations optionnelles

Contenu à analyser :
{files_content}

IMPORTANT : Ne générez aucun Markdown. Tout doit être en HTML complet avec styles en ligne.
"""
    return prompt

def get_ai_review(prompt):
    """Appelle l'API Gemini pour obtenir le mail HTML."""
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

# --- Vérification des erreurs HTML ---
def detect_html_errors(html):
    """Retourne True si le HTML contient des erreurs (balises non fermées, etc.)."""
    try:
        BeautifulSoup(html, "html.parser")
        return False  # Pas d'erreur détectée
    except Exception:
        return True

# --- Envoi d'email ---
def send_email(recipient, subject, html_body):
    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = SENDER_EMAIL
        msg['To'] = recipient
        msg['Subject'] = subject
        msg.attach(MIMEText(html_body, 'html'))

        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        server.login(SENDER_EMAIL, GMAIL_APP_PASSWORD)
        server.sendmail(SENDER_EMAIL, recipient, msg.as_string())
        server.close()
        print(f"Succès: Email de revue de code envoyé à {recipient}")
    except Exception as e:
        print(f"Erreur: Échec de l'envoi de l'email à {recipient}. Erreur: {e}")
        print("\n--- Contenu HTML non envoyé ---\n")
        print(html_body)
        print("\n-------------------------------\n")

# --- Logique principale ---
all_files = get_all_tracked_files()
code_files = filter_code_files(all_files)
files_content = get_all_files_content(code_files)
prompt = generate_prompt(files_content)
html_review = get_ai_review(prompt)

# Détection d'erreurs HTML
has_errors = detect_html_errors(html_review)

# Déterminer sujet et exit code
if has_errors:
    mail_subject = "⚠️ Revue de Code - Erreurs détectées"
    exit_code = 1
else:
    mail_subject = "✅ Revue de Code - Code Validé"
    exit_code = 0

# Envoi du mail (toujours)
send_email(RECIPIENT_EMAIL, mail_subject, html_review)

# Faire échouer le push si des erreurs
sys.exit(exit_code)
