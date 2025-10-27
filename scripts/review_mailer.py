import os
import sys
import smtplib
import glob
import json
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from google import genai

# --- Configuration ---
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL")

ERROR_HISTORY_FILE = ".code_error_history.json"  # Pour sauvegarder les erreurs historiques

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
        return f"--- Contenu du fichier: {file_path} ---\n{content}\n"
    except Exception as e:
        return f"--- Impossible de lire le fichier: {file_path} (Erreur: {e}) ---\n"

def load_error_history():
    """Charge l'historique des erreurs si le fichier existe"""
    if os.path.exists(ERROR_HISTORY_FILE):
        with open(ERROR_HISTORY_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_error_history(history):
    """Sauvegarde l'historique des erreurs"""
    with open(ERROR_HISTORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(history, f, indent=4)

def generate_prompt(all_files, old_errors):
    """Génère un prompt complet pour l'IA"""
    files_content = ""
    for file in all_files:
        if file.startswith('.github/') or file.endswith(('.png', '.jpg', '.gif', '.bin')):
            continue
        files_content += get_file_content(file)
    
    old_errors_text = ""
    if old_errors:
        for f, errs in old_errors.items():
            if errs:
                old_errors_text += f"{f} : " + "; ".join(errs) + "\n"

    prompt = f"""
Vous êtes un expert en revue de code. Analysez les fichiers suivants et générez un email complet en HTML pour le développeur :

Fichiers analysés :
{', '.join(all_files)}

Contenu des fichiers :
{files_content}

Erreurs historiques connues (anciennes erreurs persistantes) :
{old_errors_text if old_errors_text else 'Aucune'}

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
IMPORTANT : Ne générez **aucun Markdown**. Tout doit être en HTML complet avec styles en ligne.
"""
    return prompt

def get_ai_review(prompt):
    """Appelle l'API Gemini pour obtenir la revue de code HTML"""
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
    """Envoie l'email HTML via SMTP"""
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
        print("\n--- Contenu HTML non envoyé (pour débogage) ---\n")
        print(html_body)
        print("\n----------------------------------------------------\n")

# --- Logique principale ---

print(f"Début de l'analyse pour : {RECIPIENT_EMAIL}")

all_files = get_all_code_files()
old_errors = load_error_history()

review_prompt = generate_prompt(all_files, old_errors)
html_review = get_ai_review(review_prompt)

# Détecter si des erreurs existent dans la réponse de l'IA
all_detected_errors = []
if "Erreurs détectées" in html_review:
    exit_code = 1
    mail_subject = "⚠️ Revue de Code - Erreurs détectées"
    # Sauvegarder les erreurs pour le prochain push
    # Pour simplifier, on stocke le mot-clé "Erreurs détectées" pour chaque fichier
    for f in all_files:
        all_detected_errors.append("Erreurs détectées")
else:
    exit_code = 0
    mail_subject = "✅ Revue de Code - Code Validé"
    all_detected_errors = {}

# Mettre à jour l'historique
error_history_to_save = {f: all_detected_errors for f in all_files}
save_error_history(error_history_to_save)

# Envoyer le mail (toujours)
send_email(RECIPIENT_EMAIL, mail_subject, html_review)

# Faire échouer le push si des erreurs détectées
sys.exit(exit_code)
