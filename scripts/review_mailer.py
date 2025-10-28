import os
import sys
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import google.generativeai as genai
from html.parser import HTMLParser

# --- Configuration ---
GEMINI_API_KEY = "AIzaSyCnIcTxzWzfN11y6AF0KmOM88JMJFNXeGg"
GMAIL_APP_PASSWORD ="visp mkca txri giym"
SENDER_EMAIL ="ondoatamar@gmail.com"

# Valeurs par défaut si non définies (utile pour tests)
if not SENDER_EMAIL:
    SENDER_EMAIL = "tamar.ondoa@icloud.com"

# Vérification des arguments
if len(sys.argv) < 3:
    print("Erreur: L'email du destinataire et la liste des fichiers modifiés sont requis.")
    sys.exit(1)

RECIPIENT_EMAIL = sys.argv[1]

# Supporte fichiers séparés par virgules ou espaces
raw_files = sys.argv[2]
CHANGED_FILES = [f.strip() for f in raw_files.replace(',', ' ').split() if f.strip()]

# --- Vérification syntaxe HTML ---
class SyntaxChecker(HTMLParser):
    def __init__(self):
        super().__init__()
        self.errors = []

    def error(self, message):
        line, col = self.getpos()
        self.errors.append(f"Ligne {line}, Col {col} : {message}")

def check_html_syntax(html_content):
    checker = SyntaxChecker()
    try:
        checker.feed(html_content)
    except Exception as e:
        line, col = checker.getpos()
        checker.errors.append(f"Ligne {line}, Col {col} : {str(e)}")
    return checker.errors

# --- Fonctions d'aide ---
def get_file_content(file_path):
    """Lit uniquement les fichiers HTML et retourne leur contenu numéroté."""
    if not file_path.endswith(".html"):
        return None
    if not os.path.isfile(file_path):
        return f"--- Impossible de lire le fichier: {file_path} (non trouvé) ---\n"
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()[:200]
        numbered_content = "\n".join([f"{i+1}: {line}" for i, line in enumerate(lines)])
        return numbered_content
    except Exception as e:
        return f"--- Impossible de lire le fichier: {file_path} (Erreur: {e}) ---\n"

def generate_prompt(changed_files):
    """Crée le prompt d'analyse pour Gemini."""
    files_content = ""
    for file in changed_files:
        content = get_file_content(file)
        if content:
            files_content += f"--- Contenu du fichier: {file} ---\n{content}\n"

    prompt = f"""
Vous êtes un expert en revue de code. Analysez les fichiers suivants et générez un email complet **uniquement en HTML**, sans aucune syntaxe Markdown.

Fichiers à analyser :
{', '.join(changed_files)}

Contenu :
{files_content}

Contraintes du mail HTML :
- Boîte centrale blanche, bord arrondi, ombre douce
- Fond général gris clair (#f4f4f9)
- Police Arial ou sans-serif
- Titre principal : "Revue de Code - Code validé" (vert) ou "Revue de Code - Erreurs détectées" (rouge)
- Liste des erreurs détectées en rouge si présentes
- Section "Suggestions IA" en bleu pour le titre, texte gris foncé (#333)
- CSS en ligne uniquement
- Séparateurs <hr> entre sections
- Inclure extraits de code pertinents, erreurs et corrections
- Si aucun problème n'est détecté, féliciter le développeur et proposer des améliorations optionnelles
- Toujours produire un HTML complet (<html>, <body>, etc.)
- **IMPORTANT** : Ne générez **aucun Markdown**.
"""
    return prompt

def get_ai_review(prompt):
    """Analyse avec Gemini, ou génère un rapport local si clé absente."""
    if not GEMINI_API_KEY:
        return "<h3>Mode hors ligne</h3><p>Aucune clé GEMINI_API_KEY détectée. Rapport simulé localement.</p>"

    try:
        genai.configure(api_key=GEMINI_API_KEY)
        response = genai.generate_text(model="gemini-1.5-flash", prompt=prompt)
        html_content = response.text.strip()
        if html_content.startswith("```html"):
            html_content = html_content.replace("```html", "").replace("```", "").strip()
        return html_content
    except Exception as e:
        return f"<h1>Erreur d'API Gemini</h1><p>Impossible d'obtenir la revue de code. Erreur: {e}</p>"

def send_email(recipient, subject, html_body):
    """Envoie le mail HTML avec le rapport de revue de code."""
    try:
        if not GMAIL_APP_PASSWORD:
            print("⚠️ Aucun mot de passe d'application Gmail configuré. Mail non envoyé.")
            print("\n--- Contenu du mail ---\n", html_body, "\n------------------------\n")
            return

        msg = MIMEMultipart('alternative')
        msg['From'] = SENDER_EMAIL
        msg['To'] = recipient
        msg['Subject'] = subject
        msg.attach(MIMEText(html_body, 'html'))

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(SENDER_EMAIL, GMAIL_APP_PASSWORD)
            server.sendmail(SENDER_EMAIL, recipient, msg.as_string())

        print(f"✅ Email de revue de code envoyé à {recipient}")
    except Exception as e:
        print(f"❌ Erreur: impossible d'envoyer l'email à {recipient}. Erreur: {e}")
        print("\n--- Contenu HTML non envoyé ---\n")
        print(html_body)
        print("\n---------------------------------\n")

# --- Logique principale ---
print(f"Début de l'analyse pour le push de: {RECIPIENT_EMAIL}")
print(f"Fichiers modifiés: {', '.join(CHANGED_FILES)}")

# Vérification syntaxique locale
html_errors_summary = ""
for file in CHANGED_FILES:
    content = get_file_content(file)
    if content:
        errors = check_html_syntax(content)
        if errors:
            html_errors_summary += f"<h3>Erreurs de syntaxe détectées dans {file}</h3><ul>"
            for err in errors:
                html_errors_summary += f"<li>{err}</li>"
            html_errors_summary += "</ul><hr>"

# Génération de la revue IA
review_prompt = generate_prompt(CHANGED_FILES)
html_review = get_ai_review(review_prompt)

# Fusion des résultats
if html_errors_summary:
    html_review = html_errors_summary + html_review
    exit_code = 1
    mail_subject = "⚠️ Revue de Code - Erreurs détectées"
else:
    exit_code = 0
    mail_subject = "✅ Revue de Code - Code Validé"

# Envoi du rapport
send_email(RECIPIENT_EMAIL, mail_subject, html_review)

# Code de sortie pour le hook
sys.exit(exit_code)
