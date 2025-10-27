import 'dotenv/config';
import nodemailer from "nodemailer";
import { GoogleGenAI } from "@google/genai";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

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

  // --- Fonction pour lire le contenu des fichiers HTML ---
  function getFileContent(filePath) {
    if (!filePath.endsWith(".html")) {
      return null;
    }
    if (!fs.existsSync(filePath)) {
      return `--- Impossible de lire le fichier: ${filePath} (fichier non trouvé) ---\n`;
    }
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').slice(0, 200);
      const numberedContent = lines.map((line, i) => `${i+1}: ${line}`).join('\n');
      return numberedContent;
    } catch (error) {
      return `--- Impossible de lire le fichier: ${filePath} (Erreur: ${error.message}) ---\n`;
    }
  }

  // --- Fonction pour obtenir les fichiers modifiés ---
  function getChangedFiles() {
    try {
      const diffOutput = execSync("git diff --cached --name-only").toString();
      return diffOutput.trim().split('\n').filter(file => file.length > 0);
    } catch {
      return [];
    }
  }

  async function generateMail(diffText, changedFiles) {
    // Construire le contenu des fichiers HTML
    let filesContent = "";
    for (const file of changedFiles) {
      const content = getFileContent(file);
      if (content) {
        filesContent += `--- Contenu du fichier: ${file} ---\n${content}\n`;
      }
    }

    const prompt = `
Vous êtes un expert en revue de code. Analysez les fichiers suivants et générez un email complet *uniquement en HTML*, sans aucune syntaxe Markdown.

Fichiers à analyser :
${changedFiles.join(', ')}

Contenu :
${filesContent}

Diff Git :
${diffText}

Contraintes du mail HTML :
- Boîte centrale blanche, bord arrondi, ombre douce
- Fond général gris clair (#f4f4f9)
- Police Arial ou sans-serif
- Titre principal : "Revue de Code - Code validé" (vert) ou "Revue de Code - Erreurs détectées" (rouge)
- Liste des erreurs détectées en rouge si présentes
- Section "Suggestions IA" en bleu pour le titre, texte gris foncé (#333)
- CSS en ligne uniquement
- Séparateurs <hr> entre sections
- Inclure extraits de code pertinents, erreurs et corrections
- Si aucun problème n'est détecté, féliciter le développeur et proposer des améliorations optionnelles
- Toujours produire un HTML complet (<html>, <body>, etc.)
- *IMPORTANT* : Ne générez *aucun Markdown*.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text;
  }

  // --- 4️⃣ Lecture du diff et des fichiers modifiés ---
  let diffText = "Aucun diff disponible.";
  try {
    diffText = execSync("git diff --cached").toString();
  } catch {
    console.log("⚠️ Impossible de récupérer le diff Git, mail générique sera envoyé.");
  }

  const changedFiles = getChangedFiles();
  console.log(`📁 Fichiers modifiés: ${changedFiles.join(', ')}`);

  // --- 5️⃣ Génération du contenu mail ---
  let aiMailContent;
  try {
    aiMailContent = await generateMail(diffText, changedFiles);
  } catch (err) {
    console.error("❌ Erreur génération mail IA :", err);
    aiMailContent = `
      <html>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f9; margin: 0; padding: 20px;">
          <div style="max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h1 style="color: #e74c3c;">❌ Erreur d'analyse IA</h1>
            <p>Impossible de générer le contenu via l'IA. Erreur: ${err.message}</p>
          </div>
        </body>
      </html>
    `;
  }

  // --- 6️⃣ Préparation du sujet et du corps du mail ---
  let subject = status === "fail" ? "⚠ Revue de Code - Erreurs détectées" : "✅ Revue de Code - Code Validé";
  let htmlBody = aiMailContent;

  // Nettoyer le contenu HTML si nécessaire
  if (htmlBody.includes('```html')) {
    htmlBody = htmlBody.replace(/```html\n?/g, '').replace(/```\n?/g, '');
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
    html: htmlBody,
    text: "Veuillez activer l'affichage HTML pour voir le contenu complet de ce message.",
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("📧 Mail envoyé à", toEmails);
  } catch (err) {
    console.error("❌ Erreur envoi mail :", err);
    console.log("\n--- Contenu HTML non envoyé (pour débogage) ---\n");
    console.log(htmlBody);
    console.log("\n----------------------------------------------------\n");
  }

})();