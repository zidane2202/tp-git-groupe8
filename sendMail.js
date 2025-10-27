import 'dotenv/config';
import nodemailer from "nodemailer";
import fs from "fs";
import { execSync } from "child_process";

(async () => {
  const status = process.argv[2] || "success";
  let toEmails;
  if (process.env.NOTIFY_EMAILS) {
    toEmails = process.env.NOTIFY_EMAILS;
  } else {
    try {
      toEmails = execSync("git config user.email").toString().trim();
      console.log("📧 Adresse Git détectée :", toEmails);
    } catch {
      toEmails = "pythiemorne22@gmail.com";
      console.log("⚠️ Impossible de récupérer l'e-mail Git, utilisation de l'e-mail par défaut :", toEmails);
    }
  }

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
    h1 { color: ${status === "fail" ? "#d32f2f" : "#1a73e8"}; }
    .section { margin-bottom: 20px; }
    .footer { font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Revue de Code - ${status === "fail" ? "Erreurs Détectées" : "Analyse Réussie"}</h1>
    <p>Bonjour l'équipe,</p>
    <div class="section">
      <h2>Problème détecté</h2>
      <p>Aucun rapport d'analyse valide n'a pu être généré. Veuillez vérifier votre push ou contacter l'équipe pour assistance.</p>
    </div>
    <p class="footer">Cordialement, Votre Expert en Revue de Code</p>
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
    .section { margin-bottom: 20px; }
    .footer { font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Revue de Code - Erreur Critique</h1>
    <p>Bonjour l'équipe,</p>
    <div class="section">
      <h2>Erreur détectée</h2>
      <p>Une erreur s'est produite lors de la lecture du rapport : ${err.message}</p>
    </div>
    <div class="section">
      <h2>Suggestions</h2>
      <p>Veuillez vérifier que le fichier ai_report.txt existe et est accessible.</p>
      <p>Contactez l'équipe pour assistance si le problème persiste.</p>
    </div>
    <p class="footer">Cordialement, Votre Expert en Revue de Code</p>
  </div>
</body>
</html>`;
  }

  const subject = status === "fail" ? "❌ Push bloqué - Analyse IA" : "✅ Push validé - Analyse IA";
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });

  try {
    await transporter.verify();
    console.log("✅ Connexion SMTP vérifiée");
  } catch (error) {
    console.error("❌ Erreur de vérification SMTP :", error);
    console.log("Rapport généré :", htmlContent);
    process.exit(1);
  }

  const mailOptions = {
    from: `Git AI Bot <${process.env.SMTP_USER || toEmails}>`,
    to: toEmails,
    subject,
    html: htmlContent,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("📧 Mail envoyé à", toEmails);
  } catch (err) {
    console.error("❌ Erreur envoi mail :", err);
    console.log("Rapport généré :", htmlContent);
    process.exit(1);
  }
})();