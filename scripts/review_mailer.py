import os
import sys
import smtplib
import glob
import json
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from google import genai
from html.parser import HTMLParser

# --- Configuration ---
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL")

ERROR_HISTORY_FILE = ".code_error_history.json"

if len(sys.argv) < 2:
    print("Erreur: L'email du destinataire est requis.")
    sys.exit(1)

RECIPIENT_EMAIL = sys.argv[1]

# --- Fonctions d'aide ---

def get_all_code_files():
    """Récupère tous les fichiers pertinents du dépôt"""
    files = []
    for ext in ('html', 'js', 'py', 'css'):
        files.extend(glob.glob(f'**/*.{ext}', recursive=True))
    return files

def get_file_content(file_path):
    """Lit les 100 premières lignes d'un fichier"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = "".join(f.readlines()[:100])
        return content
    except Exception as e:
        return f"Erreur lecture fichier {file_path}: {e}"

def load_error_history():
    if os.path.exists(ERROR_HISTORY_FILE):
        with open(ERROR_HISTORY_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_error_history(history):
    with open(ERROR_HISTORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(history, f, indent=4)

class MyHTMLValidator(HTMLParser):
    """Validator HTML simple pour détecter balises non fermées et attributs incorrects"""
    def __init__(self):
        super().__init__()
        self.errors = []

    def handle_starttag(self, tag, attrs):
        for attr, val in attrs:
            if val is None:
                self.errors.append(f"Attribut '{attr}' sans valeur dans <{tag}>")

    def handle_endtag(self, tag):
        pass

def check_html_errors(file_path):
    """Retourne la liste des erreurs HTML détectées"""
    if not file_path.endswith(".html"):
        return []
    validator = MyHTMLValidator()
    content = get_file_content(file_path)
    try:
        validator.feed(content)
    except Exception as e:
        validator.errors.append(f"Erreur parsing HTML: {e}")
    return validator.errors

def generate_prompt(all_files, old_errors, current_errors):
    """Génère le prompt complet pour l'IA avec erreurs par fichier"""
    content_files = ""
    for f in all_files:
        content_files += f"--- {f} ---\n{get_file_content(f)}\n"

    old_err_text = ""
    if old_errors:
        for f, errs in old_errors.items():
            if errs:
                old_err_text += f"{f} : " + "; ".join(errs) + "\n"

    current_err_text = ""
    for f, errs in current_errors.items():
        if errs:
            current_err_text += f"{f} : " + "; ".join(errs) + "\n"

    prompt = f"""
Vous êtes un expert en revue de code. Analysez les fichiers suivants et les erreurs détectées, et générez un email HTML complet :

Fichiers analysés :
{', '.join(all_files)}

Contenu des fichiers :
{content_files}

Erreurs historiques :
{old_err_text if old_err_text else 'Aucune'}

Erreurs détectées dans ce commit :
{current_err_text if current_err_text else 'Aucune'}

Contraintes du mail HTML :
- Boîte centrale blanche, bord arrondi, ombre douce
- Fond général gris clair (#f4f4f9)
- Police Arial ou sans-serif
- Titre principal : "Revue de Code - Code validé" (vert) ou "Revue de Code - Erreurs détectées" (rouge)
- Liste des erreurs détectées en rouge
- Section "Suggestions IA" en bleu, texte gris foncé (#333)
- CSS en ligne uniquement
- Séparateurs <hr> entre sections
- Inclure extraits de code, erreurs et corrections
- Si aucun problème, féliciter le développeur et proposer des améliorations optionnelles
- HTML complet uniquement (<html>, <body>, etc.)
IMPORTANT : Ne générez **aucun Markdown**.
"""
    return prompt

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
        return f"<h1>Erreur API Gemini</h1><p>{e}</p>"

def send_email(recipient, subject, html_body):
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
        print(f"Email envoyé à {recipient}")
    except Exception as e:
        print(f"Erreur envoi email: {e}")
        print(html_body)

# --- Logique principale ---
all_files = get_all_code_files()
old_errors = load_error_history()

# Vérifier erreurs par fichier
current_errors = {}
for f in all_files:
    current_errors[f] = check_html_errors(f)

# Générer prompt IA
prompt = generate_prompt(all_files, old_errors, current_errors)
html_review = get_ai_review(prompt)

# Déterminer si push doit échouer
has_errors = any(current_errors[f] for f in current_errors)
subject = "⚠️ Revue de Code - Erreurs détectées" if has_errors else "✅ Revue de Code - Code validé"

# Envoyer le mail
send_email(RECIPIENT_EMAIL, subject, html_review)

# Sauvegarder erreurs pour le prochain commit
save_error_history(current_errors)

# Faire échouer le push si erreurs
sys.exit(1 if has_errors else 0)
