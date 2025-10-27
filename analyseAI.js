import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai"; // Correction de l'importation
import fs from "fs";

// Configure le client Gemini avec la clé API
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Fonction pour lire le diff depuis stdin
const readStdin = async () => {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
};

// Fonction pour générer le prompt pour l'IA
const generatePrompt = (diff) => `
Tu es un expert en analyse de code HTML, CSS et JavaScript. Ta tâche est d'analyser le diff suivant (format git diff --cached) et de produire un rapport clair et professionnel.

### Instructions :
1. Analyse le diff pour identifier :
   - Les erreurs de syntaxe, bugs évidents ou risques de sécurité.
   - Les problèmes de qualité (lisibilité, performance, conventions).
   - Les suggestions d'amélioration avec des exemples concrets.
2. Génère **uniquement** un e-mail HTML complet et esthétique (avec <html>, <body>, styles CSS en ligne).
3. L'e-mail doit être professionnel, clair, et convivial, avec :
   - Une introduction remerciant le développeur pour son push.
   - Une section listant les fichiers analysés.
   - Une section détaillant les problèmes ou confirmant que le code est impeccable.
   - Des suggestions d'amélioration si nécessaire, avec des exemples de code si pertinent.
   - Une conclusion encourageante.
4. Utilise une palette de couleurs moderne (bleu, gris clair, blanc) et une mise en page lisible pour tous les clients de messagerie.

### Diff à analyser :
${diff}

### Exemple de structure HTML :
\`\`\`html
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; color: #333; background-color: #f4f4f9; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border-radius: 8px; }
    h1 { color: #1a73e8; }
    .section { margin-bottom: 20px; }
    .code { background-color: #f1f3f4; padding: 10px; border-radius: 4px; font-family: monospace; }
    .footer { font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Revue de Code Automatisée</h1>
    <p>Bonjour [Développeur],</p>
    <div class="section">
      <h2>Fichiers analysés</h2>
      <p>...</p>
    </div>
    <div class="section">
      <h2>Résultats de l'analyse</h2>
      <p>...</p>
    </div>
    <div class="section">
      <h2>Suggestions d'amélioration</h2>
      <p>...</p>
    </div>
    <p class="footer">Merci pour votre contribution ! L'équipe AI Bot</p>
  </div>
</body>
</html>
\`\`\`

Si le diff est vide ou non analysable, génère un e-mail indiquant qu'aucune analyse n'a pu être effectuée.
`;

// Fonction principale
const main = async () => {
  const diff = await readStdin();

  if (!diff || diff.trim().length === 0) {
    const htmlContent = `
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
    <p>Aucun changement détecté dans le push. Veuillez vérifier votre commit.</p>
    <p class="footer">Merci pour votre contribution ! L'équipe AI Bot</p>
  </div>
</body>
</html>`;
    fs.writeFileSync("ai_report.txt", htmlContent, "utf8");
    console.log("✅ IA: Aucun diff à analyser");
    process.exit(0);
  }

  const prompt = generatePrompt(diff);

  try {
    const response = await ai.generateContent({
      model: "gemini-1.5-flash", // Mise à jour du modèle si nécessaire
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    let htmlContent = response.response.text().trim();
    // Nettoyer les balises markdown si présentes
    htmlContent = htmlContent.replace(/^```html\n|```$/g, "").replace(/^```[\s\S]*?\n|```$/g, "").trim();
    if (!htmlContent.includes("<html")) {
      console.warn("⚠️ Contenu non HTML reçu de l'API Gemini, utilisation d'un message par défaut.");
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
    <p>Impossible de générer un rapport d'analyse valide. Veuillez vérifier votre diff.</p>
    <p class="footer">Merci pour votre contribution ! L'équipe AI Bot</p>
  </div>
</body>
</html>`;
    }

    fs.writeFileSync("ai_report.txt", htmlContent, "utf8");
    console.log("✅ IA: Analyse générée avec succès");
    process.exit(0);
  } catch (err) {
    const errorHtml = `
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
    <h1>Erreur lors de l'Analyse</h1>
    <p>Bonjour,</p>
    <p>Une erreur s'est produite lors de l'analyse de votre code : ${err.message}</p>
    <p>Veuillez contacter l'équipe pour plus de détails.</p>
    <p class="footer">L'équipe AI Bot</p>
  </div>
</body>
</html>`;
    fs.writeFileSync("ai_report.txt", errorHtml, "utf8");
    console.error("❌ Erreur lors de l'appel Gemini :", err);
    process.exit(1);
  }
};

main();