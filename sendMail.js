import 'dotenv/config';
import nodemailer from "nodemailer";
import { GoogleGenAI } from "@google/genai";
import { execSync } from "child_process";

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
      toEmails = "pythiemorne22@gmail.com";
      console.log("⚠ Impossible de récupérer l'e-mail Git, utilisation de l'e-mail par défaut :", toEmails);
    }
  }

  // --- 3️⃣ Lecture des résultats linters ---
  let lintersResults = "";
  try {
    lintersResults = execSync("git diff --cached | npx stylelint --stdin --formatter string").toString();
  } catch {
    lintersResults = "Aucun problème détecté par les linters.";
  }

  // --- 4️⃣ Lecture du diff Git ---
  let diffText = "Aucun diff disponible.";
  try {
    diffText = execSync("git diff --cached").toString();
  } catch {
    console.log("⚠ Impossible de récupérer le diff Git, mail générique sera envoyé.");
  }

  // --- 5️⃣ Génération du mail via Gemini ---
  const ai = new GoogleGenAI({});

  async function generateMail(linters, diff) {
    const prompt = `
Tu es un assistant expert en développement. Génère un mail professionnel basé sur les informations suivantes :

1) Résultats des linters :
${linters}

2) Diff Git :
${diff}

Rédige un mail clair en français, contenant :
- Un objet de mail pertinent
- Les remarques sur les erreurs détectées
- Des suggestions pour corriger ou améliorer le code

Format :
Objet : <objet du mail>
<texte du mail>
`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text;
  }

  // --- 6️⃣ Génération du contenu mail ---
  let aiMailContent;
  let subject = status === "fail" ? "❌ Push bloqué - Analyse IA" : "✅ Push validé - Analyse IA";

  try {
    const aiResponse = await generateMail(lintersResults, diffText);

    // Extraction de l'objet généré
    const objMatch = aiResponse.match(/Objet\s*:\s*(.+)/i);
    if (objMatch) subject = objMatch[1].trim();

    // Corps du mail
    aiMailContent = `
📌 Résultats des linters :
${lintersResults || "Aucun problème détecté."}

📌 Diff des fichiers modifiés :
${diffText || "Aucun changement détecté."}

📌 Suggestions et remarques :
${aiResponse.replace(/Objet\s*:.+\n/i, "").trim()}
    `.trim();

  } catch (err) {
    console.error("❌ Erreur génération mail IA :", err);
    aiMailContent = "Impossible de générer le contenu via l'IA.";
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
    from: `Git AI Bot <${process.env.SMTP_USER}>`,
    to: toEmails,
    subject,
    text: aiMailContent,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("📧 Mail envoyé à", toEmails);
  } catch (err) {
    console.error("❌ Erreur envoi mail :", err);
  }

})(); // Fin de la fonction async auto-exécutée