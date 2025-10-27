import os
import sys
import smtplib
import traceback
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from google import genai  # ✅ fonctionne avec `google-genai` installé

# --- Configuration ---
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
SMTP_PASS = os.environ.get("SMTP_PASS")
SMTP_USER = os.environ.get("SMTP_USER")

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')


def main():
    # --- Lecture des arguments ou variables d'environnement ---
    recipient = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] else os.environ.get('RECIPIENT_EMAIL')
    changed_files_arg = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else os.environ.get('CHANGED_FILES')

    if not recipient:
        print("❌ Erreur: Aucun email destinataire trouvé (argument ou variable d'environnement manquant).")
        sys.exit(2)

    CHANGED_FILES = changed_files_arg.split() if changed_files_arg else []

    logging.info(f"Destinataire: {recipient}")
    logging.info(f"Fichiers modifiés: {len(CHANGED_FILES)}")

    # --- Fonctions internes ---
    def get_file_content(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f"--- Contenu du fichier: {file_path} ---\n{''.join(f.readlines()[:100])}\n"
        except Exception as e:
            return f"--- Impossible de lire le fichier: {file_path} (Erreur: {e}) ---\n"

    def generate_prompt(changed_files):
        prompt = (
            "Vous êtes un expert en revue de code. Analysez les fichiers suivants, "
            "identifiez les erreurs, améliorations possibles et générez une réponse HTML complète et esthétique. "
            "Félicitez le développeur si tout est correct.\n\n--- Fichiers Modifiés ---\n"
        )
        for file in changed_files:
            if file.startswith('.github/') or file.endswith(('.png', '.jpg', '.gif', '.bin')):
                continue
            prompt += get_file_content(file)
        return prompt

    def get_ai_review(prompt):
        try:
            if not GEMINI_API_KEY:
                raise RuntimeError("GEMINI_API_KEY manquant.")
            client = genai.Client(api_key=GEMINI_API_KEY)
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )
            html_content = response.text.strip()
            if html_content.startswith("```html"):
                html_content = html_content.strip("```html").strip("```").strip()
            return html_content
        except Exception as e:
            logging.error(f"Erreur Gemini: {e}")
            return f"<h1>Erreur Gemini</h1><p>{e}</p>"

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
            print(f"✅ Email envoyé à {recipient}")
        except Exception as e:
            logging.exception(f"Erreur SMTP: {e}")
            print(f"Erreur: {e}\n--- HTML non envoyé ---\n{html_body}")

    # --- Logique principale ---
    try:
        review_prompt = generate_prompt(CHANGED_FILES)
        html_review = get_ai_review(review_prompt)
        subject = "✅ Revue de Code Automatisée" if "erreur" not in html_review.lower() else "⚠️ Revue de Code avec Erreurs"
        send_email(recipient, subject, html_review)
    except Exception:
        traceback.print_exc()
        sys.exit(3)


if __name__ == "__main__":
    main()
