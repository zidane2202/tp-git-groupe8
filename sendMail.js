import 'dotenv/config';
import nodemailer from "nodemailer";
import { GoogleGenAI } from "@google/genai";
import { execSync } from "child_process";
import fs from "fs";

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

  // --- Fonction pour lire le contenu des fichiers ---
  function getFileContent(filePath) {
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
      // Essayer d'abord les fichiers en staging (pour les commits en cours)
      let diffOutput = execSync("git diff --cached --name-only").toString();
      if (diffOutput.trim()) {
        return diffOutput.trim().split('\n').filter(file => file.length > 0);
      }
      
      // Si aucun fichier en staging, utiliser le dernier commit
      diffOutput = execSync("git diff HEAD~1 --name-only").toString();
      return diffOutput.trim().split('\n').filter(file => file.length > 0);
    } catch {
      return [];
    }
  }

  async function generateMail(diffText, changedFiles) {
    // Vérifier si l'API key est configurée
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY non configurée dans les variables d'environnement");
    }

    // Construire le contenu des fichiers
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

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      return response.text;
    } catch (apiError) {
      console.error("❌ Erreur API Gemini:", apiError.message);
      throw new Error(`Erreur API Gemini: ${apiError.message}`);
    }
  }

  // --- 4️⃣ Lecture du diff et des fichiers modifiés ---
  let diffText = "Aucun diff disponible.";
  try {
    // Essayer d'abord les fichiers en staging (pour les commits en cours)
    diffText = execSync("git diff --cached").toString();
    if (!diffText.trim()) {
      // Si aucun diff en staging, utiliser le dernier commit
      diffText = execSync("git diff HEAD~1").toString();
    }
  } catch {
    console.log("⚠️ Impossible de récupérer le diff Git, mail générique sera envoyé.");
  }

  const changedFiles = getChangedFiles();
  console.log(`📁 Fichiers modifiés: ${changedFiles.join(', ')}`);

  // --- Fonction pour générer un email de fallback ---
  function generateFallbackEmail(status, changedFiles, diffText) {
    const isSuccess = status === "success";
    const titleColor = isSuccess ? "#27ae60" : "#e74c3c";
    const titleIcon = isSuccess ? "✅" : "❌";
    const titleText = isSuccess ? "Revue de Code - Code Validé" : "Revue de Code - Erreurs détectées";
    
    return `
      <html>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f9; margin: 0; padding: 20px;">
          <div style="max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h1 style="color: ${titleColor}; margin-bottom: 20px;">${titleIcon} ${titleText}</h1>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
              <h3 style="color: #495057; margin-top: 0;">📁 Fichiers modifiés</h3>
              <ul style="color: #6c757d;">
                ${changedFiles.length > 0 ? changedFiles.map(file => `<li>${file}</li>`).join('') : '<li>Aucun fichier modifié détecté</li>'}
              </ul>
            </div>

            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">

            <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
              <h3 style="color: #1976d2; margin-top: 0;">🤖 Analyse IA</h3>
              <p style="color: #333; margin-bottom: 0;">
                ${isSuccess 
                  ? "L'analyse IA n'a pas pu être effectuée, mais les linters ont validé votre code. Votre push a été autorisé avec succès !" 
                  : "L'analyse IA n'a pas pu être effectuée, mais des erreurs ont été détectées par les linters. Veuillez corriger les problèmes avant de repousser."}
              </p>
            </div>

            ${diffText !== "Aucun diff disponible." ? `
            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px;">
              <h3 style="color: #495057; margin-top: 0;">📝 Diff Git</h3>
              <pre style="background-color: #f1f3f4; padding: 10px; border-radius: 3px; overflow-x: auto; font-size: 12px; color: #333;">${diffText.substring(0, 1000)}${diffText.length > 1000 ? '\n... (diff tronqué)' : ''}</pre>
            </div>
            ` : ''}

            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px;">
              <h3 style="color: #856404; margin-top: 0;">⚠️ Note technique</h3>
              <p style="color: #333; margin-bottom: 0;">
                L'analyse IA n'a pas pu être effectuée en raison d'un problème de connexion ou de configuration API. 
                Les vérifications des linters ont été effectuées avec succès.
              </p>
            </div>

            <div style="text-align: center; margin-top: 30px; color: #6c757d; font-size: 12px;">
              <p>Email généré automatiquement par Git AI Bot</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  // --- 5️⃣ Génération du contenu mail ---
  let aiMailContent;
  try {
    aiMailContent = await generateMail(diffText, changedFiles);
  } catch (err) {
    console.error("❌ Erreur génération mail IA :", err);
    console.log("🔄 Génération d'un email de fallback...");
    aiMailContent = generateFallbackEmail(status, changedFiles, diffText);
  }

  // --- 6️⃣ Préparation du sujet et du corps du mail ---
  let subject = status === "fail" ? "⚠ Revue de Code - Erreurs détectées" : "✅ Revue de Code - Code Validé";
  let htmlBody = aiMailContent;

  // Nettoyer le contenu HTML si nécessaire
  if (htmlBody.includes('```html')) {
    htmlBody = htmlBody.replace(/```html\n?/g, '').replace(/```\n?/g, '');
  }

  // --- 7️⃣ Configuration du transporteur SMTP ---
  // Vérifier les variables d'environnement SMTP
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error("❌ Variables d'environnement SMTP manquantes :");
    console.error("   SMTP_USER:", process.env.SMTP_USER ? "✅ Définie" : "❌ Manquante");
    console.error("   SMTP_PASS:", process.env.SMTP_PASS ? "✅ Définie" : "❌ Manquante");
    console.error("   Utilisez un fichier .env avec ces variables pour configurer l'envoi d'emails.");
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
    secure: false, // true pour 465, false pour autres ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 60000, // 60 secondes
    greetingTimeout: 30000,   // 30 secondes
    socketTimeout: 60000,     // 60 secondes
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
    console.error("❌ Erreur envoi mail :", err.message);
    console.error("❌ Code d'erreur :", err.code);
    console.error("❌ Type d'erreur :", err.errno);
    
    // Vérifier si c'est un problème d'authentification
    if (err.code === 'EAUTH') {
      console.error("🔐 Problème d'authentification SMTP. Vérifiez vos identifiants.");
    } else if (err.code === 'ECONNECTION') {
      console.error("🌐 Problème de connexion SMTP. Vérifiez votre connexion internet.");
    } else if (err.code === 'ETIMEOUT') {
      console.error("⏰ Timeout SMTP. Le serveur met trop de temps à répondre.");
    }
    
    console.log("\n--- Contenu HTML non envoyé (pour débogage) ---\n");
    console.log(htmlBody);
    console.log("\n----------------------------------------------------\n");
  }

})();