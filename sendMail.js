import 'dotenv/config';
import nodemailer from "nodemailer";
import { execSync } from "child_process";
import fs from "fs";

// Le chemin du rapport est maintenant le premier argument passé au script
const REPORT_PATH = process.argv[2]; 

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
      process.stderr.write(`📧 Adresse Git détectée : ${toEmails}\n`);
    } catch {
      // Fallback si la configuration Git n'est pas disponible
      toEmails = "default@example.com"; 
      process.stderr.write(`⚠️ Impossible de récupérer l'e-mail Git, utilisation de l'e-mail par défaut : ${toEmails}\n`);
    }
  }

  // --- 2️⃣ Lecture du rapport HTML généré par analyseAI.js ---
  let htmlBody = "";
  let subject = "Revue de Code Automatisée - Statut Inconnu";
  
  if (!REPORT_PATH) {
    subject = "❌ Erreur Critique - Chemin du Rapport Manquant";
    htmlBody = `
      <html>
      <head><title>${subject}</title></head>
      <body style="font-family: sans-serif; color: #333; padding: 20px;">
        <h1 style="color: #d9534f;">Erreur Critique</h1>
        <p>Le chemin du rapport d'analyse de code n'a pas été fourni au script <code>sendMail.js</code>.</p>
        <p><strong>Veuillez vérifier votre script de hook Git :</strong> il doit capturer la sortie standard (stdout) de <code>analyseAI.js</code> et la passer en argument à <code>sendMail.js</code>.</p>
        <p>Exemple de commande dans votre hook : <code>REPORT_PATH=$(node analyseAI.js) && node sendMail.js "$REPORT_PATH"</code></p>
      </body>
      </html>
    `;
    process.stderr.write(`❌ Erreur critique : Le chemin du rapport AI n'a pas été fourni en argument.\n`);
  } else {
    try {
      // Utilisation du chemin fourni en argument
      htmlBody = fs.readFileSync(REPORT_PATH, "utf8");
      subject = extractSubjectFromHtml(htmlBody);
      process.stderr.write(`✅ Rapport HTML lu depuis ${REPORT_PATH}. Sujet: ${subject}\n`);
    } catch (err) {
      process.stderr.write(`❌ Erreur de lecture du rapport ${REPORT_PATH}: ${err.message}\n`);
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
    }
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
    process.stderr.write(`📧 Mail de revue de code envoyé à ${toEmails}\n`);
  } catch (err) {
    process.stderr.write(`❌ Erreur envoi mail : ${err.message}\n`);
    // Afficher le corps HTML en cas d'échec d'envoi pour le débogage
    process.stderr.write("\n--- Contenu HTML non envoyé (pour débogage) ---\n" + htmlBody + "\n----------------------------------------------------\n");
    process.exit(1); // Sortie en erreur si l'envoi échoue
  }

})();

