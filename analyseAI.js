import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai";
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
Tu es un expert en analyse de code HTML, CSS et JavaScript. Ta tâche est d'analyser le diff suivant (format git diff) et de produire un rapport clair et professionnel, même si des erreurs empêchent le push.

### Instructions :
1. Analyse le diff pour identifier :
   - Les erreurs de syntaxe, bugs évidents ou risques de sécurité (par exemple, XSS, mauvaises pratiques).
   - Les problèmes de qualité (lisibilité, performance, conventions de codage).
   - Les suggestions d'amélioration avec des exemples concrets de code corrigé.
2. Génère **uniquement** un e-mail HTML complet et esthétique (avec <html>, <body>, styles CSS en ligne).
3. L'e-mail doit être professionnel, clair, et convivial, avec :
   - Une introduction remerciant le développeur pour son push.
   - Une section listant les fichiers analysés (extraits du diff).
   - Une section détaillant les erreurs trouvées ou confirmant que le code est impeccable. Si des erreurs sont détectées, précise leur gravité et leur impact.
   - Des suggestions d'amélioration, avec des exemples de code si pertinent.
   - Une conclusion encourageante, même en cas d'erreurs, avec une invitation à corriger et réessayer.
4. Si le diff est vide ou non analysable, indique que l'analyse n'a pas pu être effectuée, mais suggère des vérifications (par exemple, vérifier le commit ou les fichiers staged).
5. Utilise une palette de couleurs moderne (bleu pour succès, rouge pour erreurs, gris clair, blanc) et une mise en page lisible pour tous les clients de messagerie.

### Diff à analyser :
${diff}

### Exemple de structure HTML pour un cas sans erreur :
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
      <p>analyseAI.js, sendMail.js</p>
    </div>
    <div class="section">
      <h2>Résultats de l'analyse</h2>
      <p>Aucune erreur détectée. Le code respecte les bonnes pratiques.</p>
    </div>
    <div class="section">
      <h2>Suggestions d'amélioration</h2>
      <p>Ajoutez des commentaires JSDoc pour améliorer la documentation.</p>
    </div>
    <p class="footer">Merci pour votre contribution ! L'équipe AI Bot</p>
  </div>
</body>
</html>
\`\`\`

### Exemple de structure HTML pour un cas avec erreurs :
\`\`\`html
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; color: #333; background-color: #f4f4f9; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border-radius: 8px; }
    h1 { color: #d32f2f; }
    .section { margin-bottom: 20px; }
    .code { background-color: #f1f3f4; padding: 10px; border-radius: 4px; font-family: monospace; }
    .footer { font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Revue de Code Automatisée - Erreurs Détectées</h1>
    <p>Bonjour [Développeur],</p>
    <div class="section">
      <h2>Fichiers analysés</h2>
      <p>test2ai.html</p>
    </div>
    <div class="section">
      <h2>Erreurs détectées</h2>
      <p>Balise <div> non fermée à la ligne 5, ce qui peut causer des erreurs de rendu.</p>
      <p class="code"><div id="main"></p>
      <p>Impact : Cela peut casser la mise en page dans les navigateurs.</p>
    </div>
    <div class="section">
      <h2>Suggestions d'amélioration</h2>
      <p>Fermez correctement la balise div :</p>
      <p class="code"><div id="main"></div></p>
    </div>
    <p class="footer">Merci pour votre contribution ! Corrigez les erreurs et réessayez. L'équipe AI Bot</p>
  </div>
</body>
</html>
\`\`\`
`;

// Fonction principale
const main = async () => {
  const diff = await readStdin();
  console.log("Diff reçu :", diff); // Log pour débogage

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
    <p>Aucun changement détecté dans le push. Veuillez vérifier que vos modifications sont correctement staged (git add) et commitées, ou contactez l'équipe pour assistance.</p>
    <p class="footer">Merci pour votre contribution ! L'équipe AI Bot</p>
  </div>
</body>
</html>`;
    fs.writeFileSync("ai_report.txt", htmlContent, "utf8");
    console.log("✅ IA: Aucun diff à analyser");
    process.exit(0); // Pas d'erreur, mais diff vide
  }

  const prompt = generatePrompt(diff);

  try {
    const response = await ai.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    let htmlContent = response.response.text().trim();
    console.log("Réponse brute de l'API Gemini :", htmlContent); // Log pour débogage
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
    h1 { color: #d32f2f; }
    .section { margin-bottom: 20px; }
    .footer { font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Revue de Code Automatisée - Analyse Non Valide</h1>
    <p>Bonjour,</p>
    <div class="section">
      <h2>Problème détecté</h2>
      <p>Le rapport d'analyse généré par l'IA n'est pas valide (format HTML incorrect).</p>
      <p>Diff analysé :</p>
      <pre class="code">${diff}</pre>
    </div>
    <div class="section">
      <h2>Suggestions</h2>
      <p>Veuillez vérifier votre diff ou contacter l'équipe pour assistance.</p>
    </div>
    <p class="footer">Merci pour votre contribution ! Corrigez les erreurs et réessayez. L'équipe AI Bot</p>
  </div>
</body>
</html>`;
      fs.writeFileSync("ai_report.txt", htmlContent, "utf8");
      console.log("✅ IA: Analyse non valide, rapport par défaut généré");
      process.exit(1); // Indique une erreur pour bloquer le push
    }

    fs.writeFileSync("ai_report.txt", htmlContent, "utf8");
    console.log("✅ IA: Analyse générée avec succès");
    process.exit(0); // Succès
  } catch (err) {
    const errorHtml = `
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
    <h1>Revue de Code Automatisée - Erreur Critique</h1>
    <p>Bonjour,</p>
    <div class="section">
      <h2>Erreur détectée</h2>
      <p>Une erreur s'est produite lors de l'analyse de votre code : ${err.message}</p>
      <p>Impact : L'analyse n'a pas pu être complétée.</p>
      <p>Diff analysé :</p>
      <pre class="code">${diff}</pre>
    </div>
    <div class="section">
      <h2>Suggestions</h2>
      <p>Assurez-vous que la clé API Gemini est correctement configurée dans .env.</p>
      <p>Contactez l'équipe pour assistance si le problème persiste.</p>
    </div>
    <p class="footer">Merci pour votre contribution ! Corrigez les erreurs et réessayez. L'équipe AI Bot</p>
  </div>
</body>
</html>`;
    fs.writeFileSync("ai_report.txt", errorHtml, "utf8");
    console.error("❌ Erreur lors de l'appel Gemini :", err);
    process.exit(1); // Indique une erreur pour bloquer le push
  }
};

main();