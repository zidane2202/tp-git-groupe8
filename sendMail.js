// sendMail.js
import "dotenv/config";           // Charge automatiquement les variables du .env
import nodemailer from "nodemailer";
import fs from "fs";
import { execSync } from "child_process";

// --- 1️⃣ Récupération de l'état du push ---
const status = process.argv[2] || "success";

// --- 2️⃣ Récupération des adresses e-mails ---
let toEmails;
if (process.env.NOTIFY_EMAILS) {
  toEmails = process.env.NOTIFY_EMAILS;
} else {
  try {
    // Essaie de récupérer l'e-mail Git config
    toEmails = execSync("git config user.email").toString().trim();
    console.log("📧 Adresse Git détectée :", toEmails);
  } catch {
    // Valeur par défaut si Git n'est pas disponible
    toEmails = "ton.email@exemple.com";
    console.log("⚠️ Impossible de récupérer l'e-mail Git, utilisation de l'e-mail par défaut :", toEmails);
  }
}

// --- 3️⃣ Lecture du rapport IA ---
let aiReport = "Aucun rapport disponible.";
try {
  aiReport = fs.readFileSync("ai_report.txt", "utf8");
} catch (e) {
  aiReport = "Impossible de lire ai_report.txt";
}

// --- 4️⃣ Préparation du sujet et du corps du mail ---
let subject = status === "fail" ? "❌ Push bloqué - Analyse IA" : "✅ Push validé - Analyse IA";
let body = aiReport;

// Si le rapport commence par "Objet : <...>", on l'utilise
const objMatch = aiReport.match(/Objet\s*:\s*(.+)/i);
if (objMatch) subject = objMatch[1].trim();

// --- 5️⃣ Configuration du transporteur SMTP ---
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
  secure: process.env.SMTP_SECURE === "true", // true pour 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// --- 6️⃣ Préparation du mail ---
const mailOptions = {
  from: `"Git AI Bot" <${process.env.SMTP_USER}>`,
  to: toEmails,
  subject: subject,
  text: body,
};

// --- 7️⃣ Envoi du mail ---
const main = async () => {
  try {
    await transporter.sendMail(mailOptions);
    console.log("📧 Mail envoyé à", toEmails);
  } catch (err) {
    console.error("❌ Erreur envoi mail :", err);
  }
};

main();
