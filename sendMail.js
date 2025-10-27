import 'dotenv/config';
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

// --- 1️⃣ Configuration ---
const REPORT_FILE = path.join(process.cwd(), "ai_report.txt");
const DEFAULT_SUBJECT = "Revue de Code Automatisée";

// --- 2️⃣ Fonctions d'aide ---

/**
 * Lit le rapport de l'IA, extrait le sujet et le corps HTML.
 * @returns {{subject: string, htmlBody: string}} Le sujet et le corps HTML de l'e-mail.
 */
const parseAiReport = () => {
    try {
        const reportContent = fs.readFileSync(REPORT_FILE, "utf8");
        
        // Le sujet est la première ligne commençant par "Sujet : "
        const subjectMatch = reportContent.match(/^Sujet\s*:\s*(.+)/im);
        let subject = subjectMatch ? subjectMatch[1].trim() : DEFAULT_SUBJECT;

        // Le corps HTML est le reste du contenu après le sujet (ou tout le contenu si pas de sujet)
        let htmlBody = reportContent;
        if (subjectMatch) {
            // Supprimer la ligne du sujet du corps du message
            htmlBody = reportContent.replace(subjectMatch[0], "").trim();
        }

        // Si le corps HTML n'est pas un document HTML complet, l'envelopper pour assurer le formatage
        if (!htmlBody.match(/<html/i)) {
            htmlBody = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
</head>
<body>
    ${htmlBody}
</body>
</html>`;
        }

        return { subject, htmlBody };

    } catch (err) {
        console.error("❌ Erreur lecture ou parsing du rapport IA :", err);
        return { 
            subject: `Erreur: ${DEFAULT_SUBJECT}`, 
            htmlBody: `<h1>Erreur de Génération de Rapport</h1><p>Impossible de lire le rapport de l'IA (${REPORT_FILE}).</p><p>Détails: ${err.message}</p>`
        };
    }
}

// --- 3️⃣ Logique principale ---

(async () => {
  
  // --- A. Récupération des adresses e-mails ---
  // On utilise l'adresse de l'utilisateur SMTP comme expéditeur par défaut
  const senderEmail = process.env.SMTP_USER;
  
  // Le destinataire est le premier argument passé au script
  const toEmails = process.argv[2] || process.env.NOTIFY_EMAILS;

  if (!toEmails) {
      console.error("Erreur: Adresse e-mail du destinataire non spécifiée.");
      process.exit(1);
  }

  // --- B. Lecture et préparation du contenu ---
  const { subject, htmlBody } = parseAiReport();
  
  // --- C. Configuration du transporteur SMTP ---
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
    secure: process.env.SMTP_SECURE === "true" || (process.env.SMTP_PORT === "465"), // Utiliser SSL/TLS pour le port 465
    auth: {
      user: senderEmail,
      pass: process.env.SMTP_PASS,
    },
  });

  // --- D. Préparation et envoi du mail ---
  const mailOptions = {
    from: `Git AI Bot <${senderEmail}>`,
    to: toEmails,
    subject,
    html: htmlBody, // Utilisation de 'html' au lieu de 'text'
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Mail envoyé à ${toEmails} avec le sujet: ${subject}`);
  } catch (err) {
    console.error("❌ Erreur envoi mail :", err);
    console.log("\n--- Contenu HTML non envoyé (pour débogage) ---\n");
    console.log(htmlBody);
    console.log("\n----------------------------------------------------\n");
    process.exit(1);
  }
  
})();
