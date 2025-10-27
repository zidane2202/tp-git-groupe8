import os
import sys
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html.parser import HTMLParser
from google import genai  # Assure-toi que google-genai est installé

# --- Configuration ---
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL")

if len(sys.argv) < 3:
    print("Erreur: L'email du destinataire et la liste des fichiers modifiés sont requis.")
    sys.exit(1)

RECIPIENT_EMAIL = sys.argv[1]
CHANGED_FILES = sys.argv[2].split(",") if sys.argv[2] else []

# --- Fonctions d'aide ---

def get_file_content(file_path):
    """Lit le contenu d'un fichier (100 premières lignes max)."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = "".join(f.readlines()[:100])
        return content
    except Exception as e:
        return f"--- Impossible de lire {file_path} (Erreur: {e}) ---\n"

# --- Validation HTML basique ---
class HTMLValidator(HTMLParser):
    def __init__(self):
        super().__init__()
        self.errors = []

    def handle_starttag(self, tag, attrs):
        for attr, value in attrs:
            if value is None:
                self.errors.append(f"Attribut '{attr}' non terminé dans <{tag}>")

def check_html_syntax(code):
    validator = HTMLValidator()
    try:
        validator.feed(code)
    except Exception as e:
        validator.errors.append(str(e))
    return validator.errors

# --- Génération du prompt pour l'IA ---
def generate_prompt(changed_files):
    prompt = "Vous êtes un expert en revue de code. Analysez les changements suivants :\n\n"
    for file in changed_files:
        if file.startswith('.github/') or file.endswith(('.png', '.jpg', '.gif', '.bin')):
            continue
        content = get_file_content(file)
        prompt += f"--- {file} ---\n{content}\n"
    if not prompt.strip():
        prompt += "Aucun fichier modifié fourni."
    return prompt

# --- Appel API Gemini ---
def get_ai_review(prompt):
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
        return f"<h1>Erreur d'API Gemini</h1><p>{e}</p>"

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
        print(f"Email envoyé à {recipient}")
    except Exception as e:
        print(f"Erreur d'envoi de mail : {e}\nContenu HTML pour débogage :\n{html_body}")

# --- Logique principale ---
print(f"Début de l'analyse pour : {RECIPIENT_EMAIL}")
print(f"Fichiers modifiés : {', '.join(CHANGED_FILES) if CHANGED_FILES else 'Aucun fichier'}")

# 1. Préparer le prompt IA
review_prompt = generate_prompt(CHANGED_FILES)
ai_feedback = get_ai_review(review_prompt)

# 2. Vérifier la syntaxe HTML pour chaque fichier modifié
all_errors = []
for file in CHANGED_FILES:
    if file.endswith(".html"):
        content = get_file_content(file)
        all_errors.extend(check_html_syntax(content))

# 3. Déterminer le type de mail
if all_errors:
    mail_subject = "⚠️ Revue de Code - Erreurs détectées"
    mail_body = f"<h2>Erreurs détectées dans votre code :</h2><ul>"
    for e in all_errors:
        mail_body += f"<li>{e}</li>"
    mail_body += "</ul><hr><h3>Suggestions IA :</h3>" + ai_feedback
    exit_code = 1
else:
    mail_subject = "✅ Revue de Code - Code Validé"
    mail_body = "<h2>Pas d'erreur détectée. Félicitations !</h2><hr>" + ai_feedback
    exit_code = 0

# 4. Envoyer le mail
send_email(RECIPIENT_EMAIL, mail_subject, mail_body)

# 5. Retourner code de sortie
sys.exit(exit_code)
