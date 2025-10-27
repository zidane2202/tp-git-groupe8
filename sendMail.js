import 'dotenv/config';
import nodemailer from "nodemailer";
import fs from "fs";
import { execSync } from "child_process";

// Exécuté dans une IIFE async pour une gestion propre des promesses
(async () => {
  // --- 1️⃣ Récupération de l'état du push ---
  const status = process.argv[2] || "success";

  // --- 2️⃣ Récupération des adresses e-mails ---
  let toEmails;
  if (process.env.NOTIFY_EMAILS) {
    toEmails = process.env.NOTIFY_EMAILS;
  } else {
    try {
      toEmails = execSync("git config user.email").toString().trim();
      console.log("📧 Adresse Git détectée :", toEmails);
    } catch {
      toEmails = "pythiemorne22@gmail.com"; // Adresse par défaut
      console.log("⚠️ Impossible de récupérer l'e-mail Git, utilisation de l'e-mail par défaut :", toEmails);
    }
  }

  // --- 3️⃣ Lecture du rapport IA généré par analyseAI.js ---
  let htmlContent;
  try {
    htmlContent = fs.readFileSync("ai_report.txt", "utf8");
    if (!htmlContent.includes("<html")) {
      console.warn("⚠️ Contenu non HTML détecté, utilisation d'un message par défaut.");
      htmlContent = `
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; color: #333; background-color: #f4f4f9; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border-radius: 8px; }
    h1 { color: #1a73e8; }
    .footer { font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Revue de Code Automatisée</h1>
    <p>Bonjour,</p>
    <p>Aucun rapport d'analyse valide n'a pu être généré. Veuillez vérifier votre push.</p>
    <p class="footer">Merci pour votre contribution ! L'équipe AI Bot</p>
  </div>
</body>
</html>`;
    }
  } catch (err) {
    console.error("❌ Erreur lors de la lecture de ai_report.txt :", err);
    htmlContent = `
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; color: #333; background-color: #f4f4f9; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border-radius: 8px; }
    h1 { color: #d32f2f; }
    .footer { font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Erreur lors de l'Envoi</h1>
    <p>Bonjour,</p>
    <p>Une erreur s'est produite lors de la génération du rapport : ${err.message}</p>
    <p>Veuillez contacter l'équipe pour plus de détails.</p>
    <p class="footer">L'équipe AI Bot</p>
  </div>
</body>
</html>`;
  }

  // --- 4️⃣ Configuration du sujet du mail ---
  const subject = status === "fail" ? "❌ Push bloqué - Analyse IA" : "✅ Push validé - Analyse IA";

  // --- 5️⃣ Configuration du transporteur SMTP ---
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // --- 6️⃣ Préparation et envoi du mail ---
  const mailOptions = {
    from: `Git AI Bot <${process.env.SMTP_USER || toEmails}>`,
    to: toEmails,
    subject,
    html: htmlContent, // Utilise directement le contenu HTML généré
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("📧 Mail envoyé à", toEmails);
  } catch (err) {
    console.error("❌ Erreur envoi mail :", err);
    process.exit(1);
  }
})();