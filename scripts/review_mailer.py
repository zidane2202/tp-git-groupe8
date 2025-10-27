import os
import sys
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from google import genai  # Assure-toi que google-genai est installé

# --- Configuration ---
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL")

# Vérification des arguments
if len(sys.argv) < 3:
    print("Erreur: L'email du destinataire et la liste des fichiers modifiés sont requis.")
    sys.exit(1)

RECIPIENT_EMAIL = sys.argv[1]
CHANGED_FILES = sys.argv[2].split(",") if sys.argv[2] else []

# --- Fonctions d'aide ---

def get_file_content(file_path):
    """Lit le contenu d'un fichier, limité aux 100 premières lignes."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = "".join(f.readlines()[:100])
        return f"--- Contenu du fichier: {file_path} ---\n{content}\n"
    except Exception as e:
        return f"--- Impossible de lire le fichier: {file_path} (Erreur: {e}) ---\n"

def generate_prompt(changed_files):
    """Génère le prompt pour l'IA, même si aucun fichier n'est présent."""
    if not changed_files:
        return (
            "Aucun fichier modifié fourni. "
            "Veuillez indiquer les changements pour une revue de code complète."
        )
    
    prompt = (
        "Vous êtes un expert en revue de code. Analysez les changements suivants "
        "et générez un e-mail HTML complet et esthétique avec feedback professionnel.\n\n"
    )
    for file in changed_files:
        if file.startswith('.github/') or file.endswith(('.png', '.jpg', '.gif', '.bin')):
            continue
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
        print(f"Erreur: Échec de l'envoi de l'email à {recipient}. Erreur: {e}")
        print("\n--- Contenu HTML pour débogage ---\n")
        print(html_body)
        print("\n-----------------------------------\n")

# --- Logique principale ---

print(f"Début de l'analyse pour: {RECIPIENT_EMAIL}")
print(f"Fichiers modifiés: {', '.join(CHANGED_FILES) if CHANGED_FILES else 'Aucun fichier détecté'}")

review_prompt = generate_prompt(CHANGED_FILES)
html_review = get_ai_review(review_prompt)

email_subject = "Revue de Code Automatisée - Push sur le dépôt"

send_email(RECIPIENT_EMAIL, email_subject, html_review)
