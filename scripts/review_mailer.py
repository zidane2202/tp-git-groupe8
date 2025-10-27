import os
import sys
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from google_genai import Client  # Correct import pour Google GenAI

# --- Configuration ---
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL")

# Arguments : email du destinataire + fichiers modifiés
if len(sys.argv) < 3:
    print("Erreur: L'email du destinataire et la liste des fichiers modifiés sont requis.")
    sys.exit(1)

RECIPIENT_EMAIL = sys.argv[1]
CHANGED_FILES = sys.argv[2].split()

# --- Fonctions ---
def get_file_content(file_path):
    """Lit le contenu d'un fichier (100 premières lignes max)."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = "".join(f.readlines()[:100])
        return f"--- Contenu du fichier: {file_path} ---\n{content}\n"
    except Exception as e:
        return f"--- Impossible de lire le fichier: {file_path} (Erreur: {e}) ---\n"

def generate_prompt(changed_files):
    """Génère le prompt pour l'IA en incluant le contenu des fichiers."""
    prompt = (
        "Vous êtes un expert en revue de code. Analysez les fichiers suivants "
        "et générez un e-mail HTML de feedback professionnel.\n\n"
        "--- Fichiers Modifiés ---\n"
    )
    for file in changed_files:
        if file.startswith('.github/') or file.endswith(('.png', '.jpg', '.gif', '.bin')):
            continue
        prompt += get_file_content(file)
    return prompt

def get_ai_review(prompt):
    """Appelle l'API Gemini pour obtenir la revue de code HTML."""
    try:
        client = Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        html_content = response.text.strip()
        if html_content.startswith("```html"):
            html_content = html_content.strip("```html").strip("```").strip()
        return html_content
    except Exception as e:
        return f"<h1>Erreur d'API Gemini</h1><p>Impossible d'obtenir la revue. Erreur: {e}</p>"

def send_email(recipient, subject, html_body):
    """Envoie l'email HTML via Gmail SMTP."""
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

        print(f"Succès: Email envoyé à {recipient}")
    except Exception as e:
        print(f"Erreur: Impossible d'envoyer l'email à {recipient}. Erreur: {e}")
        print("\n--- Contenu HTML (debug) ---\n")
        print(html_body)

# --- Main ---
print(f"Début de l'analyse pour le push de: {RECIPIENT_EMAIL}")
print(f"Fichiers modifiés: {', '.join(CHANGED_FILES)}")

prompt = generate_prompt(CHANGED_FILES)
html_review = get_ai_review(prompt)
send_email(RECIPIENT_EMAIL, "Revue de Code Automatisée - Push", html_review)
