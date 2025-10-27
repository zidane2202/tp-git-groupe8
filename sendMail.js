import 'dotenv/config';
import nodemailer from "nodemailer";
import { execSync } from "child_process";
import fs from "fs";
import path from "path"; // Importation de 'path'

// Définir le chemin absolu pour le rapport
const REPORT_PATH = path.resolve(process.cwd(), "ai_report.html");

// Fonction utilitaire pour lire le titre du HTML
function extractSubjectFromHtml(htmlContent) {
  const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : "Revue de Code Automatisée";
}

// Version corrigée : tout est exécuté dans une IIFE async pour permettre l'utilisation d'`await` en toute sécurité.
(async () => {
  // --- 1️⃣ Récupération des adresses e-mails ---
  let toEmails;
  if (process.env.NOTIFY_EMAILS) {
    toEmails = process.env.NOTIFY_EMAILS;
  } else {
    try {
      // Tente de récupérer l'e-mail de l'utilisateur Git
      toEmails = execSync("git config user.email").toString().trim();
      console.log("📧 Adresse Git détectée :", toEmails);
    } catch {
      // Fallback si la configuration Git n'est pas disponible
      toEmails = "default@example.com"; 
      console.log("⚠️ Impossible de récupérer l'e-mail Git, utilisation de l'e-mail par défaut :", toEmails);
    }
  }

  // --- 2️⃣ Lecture du rapport HTML généré par analyseAI.js ---
  let htmlBody = "";
  let subject = "Revue de Code Automatisée - Statut Inconnu";

  try {
    // Utilisation du chemin absolu
    htmlBody = fs.readFileSync(REPORT_PATH, "utf8");
    subject = extractSubjectFromHtml(htmlBody);
    console.log(`✅ Rapport HTML lu depuis ${REPORT_PATH}. Sujet: ${subject}`);
  } catch (err) {
    console.error(`❌ Erreur de lecture du rapport ${REPORT_PATH}:`, err);
    // Génération d'un corps HTML d'erreur
    subject = "❌ Erreur Critique - Revue de Code Automatisée";
    htmlBody = `
      <html>
      <head><title>${subject}</title></head>
      <body style="font-family: sans-serif; color: #333; padding: 20px;">
        <h1 style="color: #d9534f;">Erreur Critique</h1>
        <p>Le rapport d'analyse de code (<code>${REPORT_PATH}</code>) n'a pas pu être lu ou généré.</p>
        <p>Veuillez vérifier l'exécution du script <code>analyseAI.js</code>. Erreur système :</p>
        <pre style="background-color: #f9f9f9; padding: 10px; border: 1px solid #eee;">${err.message}</pre>
      </body>
      </html>
    `;
    // On ne sort pas en erreur ici pour s'assurer que l'e-mail d'erreur est envoyé.
  }

  // --- 3️⃣ Configuration du transporteur SMTP ---
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
    secure: process.env.SMTP_SECURE === "true", // Utilisez 'true' pour le port 465, 'false' pour 587 (TLS)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // --- 4️⃣ Préparation et envoi du mail ---
  const mailOptions = {
    from: `Git AI Bot <${process.env.SMTP_USER || toEmails}>`,
    to: toEmails,
    subject: subject,
    // On envoie le contenu du rapport comme corps HTML de l'e-mail
    html: htmlBody,
    // Le champ 'text' est important pour les clients qui ne supportent pas le HTML
    text: `Veuillez ouvrir cet e-mail dans un client supportant le HTML pour voir la revue de code complète. Sujet: ${subject}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("📧 Mail de revue de code envoyé à", toEmails);
  } catch (err) {
    console.error("❌ Erreur envoi mail :", err);
    // Afficher le corps HTML en cas d'échec d'envoi pour le débogage
    console.log("\n--- Contenu HTML non envoyé (pour débogage) ---\n" + htmlBody + "\n----------------------------------------------------\n");
    process.exit(1); // Sortie en erreur si l'envoi échoue
  }

})();

