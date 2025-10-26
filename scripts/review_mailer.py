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

if len(sys.argv) < 2:
    print("Erreur: L'email du destinataire est requis.")
    sys.exit(1)

RECIPIENT_EMAIL = sys.argv[1]

# --- Fonctions d'aide ---

def get_file_content(file_path):
    """Lit le contenu d'un fichier (jusqu'à 100 lignes)."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = "".join(f.readlines()[:100])
        return f"--- Contenu du fichier: {file_path} ---\n{content}\n"
    except Exception as e:
        return f"--- Impossible de lire le fichier: {file_path} (Erreur: {e}) ---\n"

def gather_project_files():
    """Récupère tous les fichiers pertinents du projet."""
    files = []
    for root, dirs, filenames in os.walk("."):
        # Ignorer certains dossiers
        dirs[:] = [d for d in dirs if d not in ['.git', '__pycache__', 'venv']]
        for file in filenames:
            if file.endswith(('.py', '.js', '.html', '.css', '.md')):  # Extensions pertinentes
                files.append(os.path.join(root, file))
    return files

def generate_prompt(all_files):
    """Génère le prompt pour l'IA avec le contenu de tous les fichiers."""
    prompt = (
        "Vous êtes un expert en revue de code. Analysez l'ensemble du projet, "
        "concentrez-vous sur la qualité, cohérence, erreurs potentielles et améliorations. "
        "Générez une réponse **HTML complète et esthétique** pour un email.\n\n"
    )
    
    for file in all_files:
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
    """Envoie l'email HTML via SMTP (Gmail)."""
    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = SMTP_USER
        msg['To'] = recipient
        msg['Subject'] = subject
        msg.attach(MIMEText(html_body, 'html'))

        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        server.ehlo()
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_USER, recipient, msg.as_string())
        server.close()
        print(f"Succès: Email envoyé à {recipient}")
    except Exception as e:
        print(f"Erreur: Échec de l'envoi de l'email à {recipient}. Erreur: {e}")
        print("\n--- Contenu HTML non envoyé (pour débogage) ---\n")
        print(html_body)
        print("\n----------------------------------------------------\n")

# --- Logique principale ---
print(f"Début de l'analyse complète du projet pour: {RECIPIENT_EMAIL}")

all_files = gather_project_files()
print(f"Fichiers trouvés pour analyse: {len(all_files)}")

# 1. Générer le prompt
review_prompt = generate_prompt(all_files)

# 2. Obtenir la revue IA
html_review = get_ai_review(review_prompt)

# 3. Détecter les erreurs dans le code
errors_detected = any(keyword in html_review.lower() for keyword in ["erreur", "bug", "warning", "fail"])

# 4. Déterminer le sujet de l'email
email_subject = (
    "⚠️ Revue de Code Automatisée - Erreurs détectées"
    if errors_detected else
    "✅ Revue de Code Automatisée - Code validé"
)

# 5. Envoyer l'email
send_email(RECIPIENT_EMAIL, email_subject, html_review)

# 6. Faire échouer le push si erreurs détectées
if errors_detected:
    print("Des erreurs ont été détectées dans le code. Le push va échouer.")
    sys.exit(1)
else:
    print("Le code est valide. Le push peut continuer.")
