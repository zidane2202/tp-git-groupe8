import 'dotenv/config';
import nodemailer from "nodemailer";
import fs from "fs";
import { execSync } from "child_process";

// Nom du fichier contenant le corps HTML de l'email généré par analyseAI.js
const REPORT_FILE = "ai_report.html";
const DEFAULT_SUBJECT = "Revue de Code Automatisée - Push sur ai-projet-git";

(async () => {
  // --- 1️⃣ Récupération des adresses e-mails ---
  let toEmails;
  // On utilise NOTIFY_EMAILS s'il est défini, sinon on essaie de récupérer l'email Git
  if (process.env.NOTIFY_EMAILS) {
    toEmails = process.env.NOTIFY_EMAILS;
  } else {
    try {
      // Tente de récupérer l'email de l'utilisateur Git
      toEmails = execSync("git config user.email").toString().trim();
      console.log("📧 Adresse Git détectée :", toEmails);
    } catch {
      // Adresse par défaut si l'email Git n'est pas trouvé
      toEmails = "pythiemorne22@gmail.com"; 
      console.log("⚠️ Impossible de récupérer l'e-mail Git, utilisation de l'e-mail par défaut :", toEmails);
    }
  }

  // --- 2️⃣ Lecture du rapport HTML généré par l'IA ---
  let htmlBody;
  try {
    htmlBody = fs.readFileSync(REPORT_FILE, "utf8");
    console.log(`✅ Rapport HTML lu depuis ${REPORT_FILE}`);
  } catch (err) {
    console.error(`❌ Erreur: Impossible de lire le fichier de rapport ${REPORT_FILE}.`, err);
    // Corps de l'email d'erreur si le fichier n'est pas trouvé
    htmlBody = `
      <html><body>
        <h1 style="color: red;">Erreur Critique: Rapport IA Manquant</h1>
        <p>Le script d'analyse IA n'a pas pu générer le fichier de rapport attendu (${REPORT_FILE}).</p>
        <p>Veuillez vérifier l'exécution de la phase d'analyse.</p>
      </body></html>
    `;
  }
  
  // --- 3️⃣ Détermination du sujet de l'email ---
  // On pourrait analyser le contenu HTML pour un sujet plus précis,
  // mais pour rester fidèle à l'exemple Python, on utilise un sujet statique.
  const subject = DEFAULT_SUBJECT;

  // --- 4️⃣ Configuration du transporteur SMTP ---
  // Utilisation des variables d'environnement pour la configuration SMTP (comme dans l'exemple original)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 465, // 465 pour SSL/TLS (comme le Python)
    secure: process.env.SMTP_PORT ? process.env.SMTP_SECURE === "true" : true, // true pour 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // --- 5️⃣ Préparation et envoi du mail ---
  const mailOptions = {
    from: `Git AI Bot <${process.env.SMTP_USER || toEmails}>`,
    to: toEmails,
    subject: subject,
    html: htmlBody, // On envoie le corps en HTML
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("📧 Mail envoyé à", toEmails);
    console.log("Message ID:", info.messageId);
  } catch (err) {
    console.error("❌ Erreur envoi mail. Vérifiez les variables SMTP_USER et SMTP_PASS (mot de passe d'application Gmail).", err);
  }
  
})();
