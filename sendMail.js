import 'dotenv/config';
import nodemailer from "nodemailer";
import { GoogleGenAI } from "@google/genai";
import { execSync } from "child_process";

// Version corrigée : tout est exécuté dans une IIFE async pour permettre l'utilisation d'`await` en toute sécurité.
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
      toEmails = "pythiemorne22@gmail.com"; // adresse par défaut fournie
      console.log("⚠️ Impossible de récupérer l'e-mail Git, utilisation de l'e-mail par défaut :", toEmails);
    }
  }

  // --- 3️⃣ Génération du mail via Gemini (Google GenAI) ---
  const ai = new GoogleGenAI({});

  async function generateMail(diffText) {
    const prompt = `
Tu es un assistant expert en développement. Génère un mail professionnel basé sur le diff suivant :
1) Résultats des linters et autres outils d'analyse statique
2) Diff Git des fichiers modifiés
3) Recommandations, remarques et suggestions d'amélioration pour le projet

Diff :
${diffText}
Réponds en français, format : 
Objet : <objet du mail>
<texte du mail>
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text;
  }

  // --- 4️⃣ Lecture du diff pour le rapport IA ---
  let diffText = "Aucun diff disponible.";
  try {
    diffText = execSync("git diff --cached").toString();
  } catch {
    console.log("⚠️ Impossible de récupérer le diff Git, mail générique sera envoyé.");
  }

  // --- 5️⃣ Génération du contenu mail ---
  let aiMailContent;
  try {
    aiMailContent = await generateMail(diffText);
  } catch (err) {
    console.error("❌ Erreur génération mail IA :", err);
    aiMailContent = "Impossible de générer le contenu via l'IA.";
  }

  // --- 6️⃣ Préparation du sujet et du corps du mail ---
  let subject = status === "fail" ? "❌ Push bloqué - Analyse IA" : "✅ Push validé - Analyse IA";
  let body = aiMailContent;

  // Si Gemini retourne "Objet : ..." on l'utilise
  try {
    const objMatch = aiMailContent.match(/Objet\s*:\s*(.+)/i);
    if (objMatch) subject = objMatch[1].trim();
  } catch {
    // ignore si aiMailContent n'est pas une string
  }

  // --- 7️⃣ Configuration du transporteur SMTP ---
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // --- 8️⃣ Préparation et envoi du mail ---
  const mailOptions = {
    from: `Git AI Bot <${process.env.SMTP_USER || toEmails}>`,
    to: toEmails,
    subject,
    text: body,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("📧 Mail envoyé à", toEmails);
  } catch (err) {
    console.error("❌ Erreur envoi mail :", err);
  }

})();
