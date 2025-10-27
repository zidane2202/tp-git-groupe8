import os
import sys
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html.parser import HTMLParser
from google import genai

# --- Configuration ---
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL")

if len(sys.argv) < 3:
    print("Erreur: L'email du destinataire et la liste des fichiers modifiés sont requis.")
    sys.exit(1)

RECIPIENT_EMAIL = sys.argv[1]
CHANGED_FILES = sys.argv[2].split()

# --- HTML Validator ---
class HTMLValidator(HTMLParser):
    def __init__(self):
        super().__init__()
        self.errors = []
        self.open_tags = []

    def handle_starttag(self, tag, attrs):
        for attr, value in attrs:
            if value is None:
                self.errors.append(f"Attribut '{attr}' sans valeur dans <{tag}> à la ligne {self.getpos()[0]}")
        self.open_tags.append((tag, self.getpos()[0]))

    def handle_endtag(self, tag):
        if not self.open_tags:
            self.errors.append(f"Balise fermante </{tag}> sans balise ouvrante correspondante à la ligne {self.getpos()[0]}")
        else:
            last_tag, line = self.open_tags.pop()
            if last_tag != tag:
                self.errors.append(f"Balise fermante </{tag}> ne correspond pas à <{last_tag}> ouverte à la ligne {line}")

    def close(self):
        super().close()
        for tag, line in self.open_tags:
            self.errors.append(f"Balise <{tag}> ouverte à la ligne {line} non fermée")

# --- Fonctions d'aide ---
def get_file_content(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = "".join(f.readlines())
        return content
    except Exception as e:
        return f"--- Impossible de lire le fichier: {file_path} (Erreur: {e}) ---\n"

def validate_html_files(files):
    errors = []
    for file in files:
        if file.endswith(".html"):
            validator = HTMLValidator()
            content = get_file_content(file)
            validator.feed(content)
            validator.close()
            for err in validator.errors:
                errors.append(f"{file}: {err}")
    return errors

def generate_email_html(errors, changed_files):
    # Déterminer style et titre
    if errors:
        title = "⚠️ Revue de Code - Erreurs détectées"
        color = "#e74c3c"  # rouge
        error_section = "<ul>" + "".join(f"<li>{err}</li>" for err in errors) + "</ul>"
    else:
        title = "✅ Revue de Code - Code validé"
        color = "#27ae60"  # vert
        error_section = "<p>Aucune erreur critique détectée. Bravo !</p>"

    # Suggestions génériques (toujours affichées)
    suggestions = """
    <p style="color:#333;">Suggestions IA :</p>
    <ul style="color:#333;">
        <li>Ajouter des docstrings pour toutes les fonctions.</li>
        <li>Utiliser des noms de variables explicites.</li>
        <li>Vérifier les bonnes pratiques CSS et HTML.</li>
    </ul>
    """

    html = f"""
<html>
  <body style="background-color:#f4f4f9; font-family:Arial, sans-serif; margin:0; padding:0;">
    <div style="max-width:600px; margin:20px auto; background-color:#fff; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.1); padding:20px;">
      <h2 style="color:{color}; text-align:center;">{title}</h2>
      <hr>
      <p>Fichiers analysés : {', '.join(changed_files)}</p>
      <h3 style="color:#2980b9;">Erreurs détectées :</h3>
      {error_section}
      <hr>
      {suggestions}
      <hr>
      <p style="font-size:12px; color:#888;">Ceci est un email automatique généré par le système de revue de code.</p>
    </div>
  </body>
</html>
"""
    return html

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
        print(f"Succès: Email envoyé à {recipient}")
    except Exception as e:
        print(f"Erreur: Échec de l'envoi de l'email à {recipient}. Erreur: {e}")
        print(html_body)

# --- Logique principale ---
all_errors = validate_html_files(CHANGED_FILES)
email_html = generate_email_html(all_errors, CHANGED_FILES)
mail_subject = "⚠️ Revue de Code - Erreurs détectées" if all_errors else "✅ Revue de Code - Code validé"

send_email(RECIPIENT_EMAIL, mail_subject, email_html)

# Faire échouer le push si erreurs
sys.exit(1 if all_errors else 0)
