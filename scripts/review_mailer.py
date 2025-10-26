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
CHANGED_FILES = sys.argv[2:]  # <- Prend tous les fichiers correctement

# --- Fonctions ---
def get_file_content(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = "".join(f.readlines()[:100])
        return f"--- Contenu du fichier: {file_path} ---\n{content}\n"
    except Exception as e:
        return f"--- Impossible de lire le fichier: {file_path} (Erreur: {e}) ---\n"

def generate_prompt(changed_files):
    prompt = (
        "Vous êtes un expert en revue de code. Votre tâche est d'analyser les changements de code suivants, "
        "en vous concentrant sur la qualité, la cohérence, les erreurs potentielles et les améliorations. "
        "Après l'analyse, vous devez générer une réponse **uniquement** sous forme de code HTML complet et esthétique "
        "pour un e-mail de feedback. L'e-mail doit être très beau, professionnel et convivial. "
        "Si le code est impeccable, dites-le. Sinon, proposez des corrections."
        "\n\n--- Fichiers Modifiés ---\n"
    )
    for file in changed_files:
        if file.startswith('.github/') or file.endswith(('.png', '.jpg', '.gif', '.bin')):
            continue
        prompt += get_file_content(file)
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
        return f"<h1>Erreur d'API Gemini</h1><p>Erreur: {e}</p>"

def send_email(recipient, subject, html_body):
    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = SMTP_USER
        msg['To'] = recipient
        msg['Subject'] = subject
        msg.attach(MIMEText(html_body, 'html'))

        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_USER, recipient, msg.as_string())
        server.quit()
        print(f"Succès: Email envoyé à {recipient}")
    except Exception as e:
        print(f"Erreur: Impossible d'envoyer l'email à {recipient}. Erreur: {e}")
        print("\n--- Contenu HTML non envoyé ---\n", html_body)

# --- Logique principale ---
print(f"Analyse pour le push de: {RECIPIENT_EMAIL}")
print(f"Fichiers modifiés: {', '.join(CHANGED_FILES)}")

prompt = generate_prompt(CHANGED_FILES)
html_review = get_ai_review(prompt)
email_subject = "Revue de Code Automatisée - Push sur ai-projet-git"
send_email(RECIPIENT_EMAIL, email_subject, html_review)
