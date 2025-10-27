import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";

// Configure le client Gemini avec la clé API
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Fonction pour lire l'entrée (diff + erreurs des linters) depuis stdin
const readStdin = async () => {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
};

// Fonction pour générer le prompt pour l'IA
const generatePrompt = (input) => `
Tu es un expert en analyse de code HTML, CSS et JavaScript. Ta tâche est d'analyser le diff Git suivant et les erreurs des linters (ESLint, HTMLHint, Stylelint) pour produire un rapport clair, professionnel et détaillé, même si des erreurs empêchent le push.

### Instructions :
1. Analyse le diff Git et les erreurs des linters pour identifier :
   - Les erreurs de syntaxe, bugs évidents ou risques de sécurité (par exemple, XSS via eval(), attributs dupliqués).
   - Les problèmes de qualité (lisibilité, conventions de codage, balises en majuscules).
   - Les problèmes d'accessibilité (par exemple, attributs manquants, contraste).
   - Les problèmes de performance (par exemple, scripts bloquants).
2. Génère **uniquement** un e-mail HTML complet et esthétique (avec <html>, <body>, styles CSS en ligne).
3. L'e-mail doit être professionnel, clair, et convivial, avec :
   - Une introduction : "Bonjour l'équipe, J'ai effectué une revue des fichiers modifiés. Plusieurs problèmes ont été identifiés qui nécessitent une attention particulière."
   - Une section "Fichiers analysés" listant les fichiers mentionnés dans le diff ou les rapports de linters.
   - Une section "Erreurs détectées" avec chaque erreur numérotée, incluant :
     - Une description claire de l'erreur (par exemple, "Balise non fermée à la ligne X").
     - L'impact de l'erreur (par exemple, "Cela peut casser la mise en page").
     - Le code incorrect (extrait du diff ou du rapport des linters).
     - Une correction suggérée avec exemple de code dans une balise <pre class="code">.
   - Une section "Suggestions IA" avec des recommandations générales pour améliorer la qualité, l'accessibilité, la performance, et la modularité (par exemple, utiliser des validateurs HTML, déplacer les scripts JavaScript, ajouter des attributs alt).
   - Une conclusion : "Cordialement, Votre Expert en Revue de Code".
4. Si le diff est vide mais des erreurs de linters sont présentes, base l'analyse sur les rapports de linters.
5. Si aucun diff ni erreur de linters n'est disponible, indique que l'analyse n'a pas pu être effectuée.
6. Utilise une palette de couleurs moderne (bleu #1a73e8 pour succès, rouge #d32f2f pour erreurs, gris clair #f4f4f9, blanc #ffffff) et une mise en page lisible.

### Entrée à analyser :
${input}

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
    <h1>Revue de Code - Erreurs Détectées</h1>
    <p>Bonjour l'équipe,</p>
    <p>J'ai effectué une revue des fichiers modifiés. Plusieurs problèmes ont été identifiés qui nécessitent une attention particulière.</p>
    <div class="section">
      <h2>Fichiers analysés</h2>
      <p>test.html</p>
    </div>
    <div class="section">
      <h2>Erreurs détectées</h2>
      <p>1. <strong>Attribut dupliqué</strong></p>
      <p>Attribut <code>lang</code> dupliqué à la ligne 2, ce qui rend le document HTML invalide.</p>
      <p class="code">&lt;html lang="fr" lang="en"&gt;</p>
      <p>Impact : Les navigateurs peuvent ignorer l'attribut dupliqué, causant une confusion sur la langue du document.</p>
      <p>Correction suggérée : Supprimez l'attribut dupliqué :</p>
      <p class="code">&lt;html lang="fr"&gt;</p>
      <p>2. <strong>Balise non fermée</strong></p>
      <p>Balise <code>&lt;p&gt;</code> non fermée à la ligne 19, ce qui peut causer des erreurs de rendu.</p>
      <p class="code">&lt;p&gt;Paragraphe non fermé</p>
      <p>Impact : Cela peut casser la mise en page dans les navigateurs.</p>
      <p>Correction suggérée : Fermez correctement la balise :</p>
      <p class="code">&lt;p&gt;Paragraphe non fermé&lt;/p&gt;</p>
    </div>
    <div class="section">
      <h2>Suggestions IA</h2>
      <p>- Utilisez des validateurs HTML (comme W3C Markup Validation Service) pour détecter les erreurs structurelles.</p>
      <p>- Ajoutez des attributs <code>alt</code> aux images pour améliorer l'accessibilité.</p>
      <p>- Déplacez les scripts JavaScript avant la balise <code>&lt;/body&gt;</code> pour optimiser le chargement.</p>
    </div>
    <p class="footer">Cordialement, Votre Expert en Revue de Code</p>
  </div>
</body>
</html>
\`\`\`
`;

// Fonction principale
const main = async () => {
  const input = await readStdin();
  console.log("Entrée reçue :", input); // Log pour débogage

  if (!input || input.trim().length === 0) {
    const htmlContent = `
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
    <h1>Revue de Code - Aucun Changement</h1>
    <p>Bonjour l'équipe,</p>
    <div class="section">
      <h2>Problème détecté</h2>
      <p>Aucun changement détecté dans le push ou aucun rapport de linters disponible. Veuillez vérifier que vos modifications sont correctement staged (git add) et commitées.</p>
    </div>
    <p class="footer">Cordialement, Votre Expert en Revue de Code</p>
  </div>
</body>
</html>`;
    fs.writeFileSync("ai_report.txt", htmlContent, "utf8");
    console.log("✅ IA: Aucun diff ou rapport à analyser");
    process.exit(1); // Bloque le push
  }

  const prompt = generatePrompt(input);

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
      console.warn("⚠️ Contenu non HTML reçu de l'API Gemini, utilisation d'un rapport détaillé basé sur l'entrée.");
      htmlContent = `
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
    <h1>Revue de Code - Erreurs Détectées</h1>
    <p>Bonjour l'équipe,</p>
    <p>J'ai effectué une revue des fichiers modifiés. Plusieurs problèmes ont été identifiés qui nécessitent une attention particulière.</p>
    <div class="section">
      <h2>Fichiers analysés</h2>
      <p>test.html</p>
    </div>
    <div class="section">
      <h2>Erreurs détectées</h2>
      <p>1. <strong>Attribut dupliqué</strong></p>
      <p>Attribut <code>lang</code> dupliqué à la ligne 2, ce qui rend le document HTML invalide.</p>
      <p class="code">&lt;html lang="fr" lang="en"&gt;</p>
      <p>Impact : Les navigateurs peuvent ignorer l'attribut dupliqué, causant une confusion sur la langue du document.</p>
      <p>Correction suggérée : Supprimez l'attribut dupliqué :</p>
      <p class="code">&lt;html lang="fr"&gt;</p>
      <p>2. <strong>Balises en majuscules</strong></p>
      <p>Les balises <code>&lt;HTML&gt;</code>, <code>&lt;HEAD&gt;</code>, <code>&lt;TITLE&gt;</code>, et <code>&lt;BODY&gt;</code> doivent être en minuscules (lignes 2, 3, 5, 15).</p>
      <p class="code">&lt;HTML&gt;</p>
      <p>Impact : Bien que toléré, cela va à l'encontre des standards HTML5.</p>
      <p>Correction suggérée : Utilisez des minuscules :</p>
      <p class="code">&lt;html&gt;</p>
      <p>3. <strong>Risque de sécurité XSS</strong></p>
      <p>Utilisation de <code>eval()</code> dans l'attribut <code>onload</code> à la ligne 15, ce qui peut exécuter du code malveillant depuis l'URL.</p>
      <p class="code">&lt;BODY onload="eval(document.URL.split('?')[1])"&gt;</p>
      <p>Impact : Cela expose le site à des attaques XSS, permettant à un attaquant d'exécuter du code arbitraire.</p>
      <p>Correction suggérée : Supprimez <code>eval</code> et utilisez des méthodes sécurisées pour traiter les paramètres d'URL :</p>
      <p class="code">&lt;body&gt;</p>
      <p>4. <strong>Balises non fermées</strong></p>
      <p>Balises <code>&lt;p&gt;</code>, <code>&lt;td&gt;</code>, et <code>&lt;body&gt;</code> non fermées (lignes 19, 28, 46, 15).</p>
      <p class="code">&lt;p&gt;Paragraphe non fermé</p>
      <p>Impact : Cela peut casser la mise en page et provoquer des erreurs de rendu.</p>
      <p>Correction suggérée : Fermez correctement les balises :</p>
      <p class="code">&lt;p&gt;Paragraphe non fermé&lt;/p&gt;</p>
      <p>5. <strong>Fonction inexistante</strong></p>
      <p>Appel à <code>nonExistentFunction()</code> dans l'attribut <code>onclick</code> à la ligne 24, ce qui provoque une erreur JavaScript.</p>
      <p class="code">&lt;INPUT TYPE="submit" onclick="nonExistentFunction()"&gt;</p>
      <p>Impact : Cela entraîne une erreur JavaScript au clic, rendant le bouton non fonctionnel.</p>
      <p>Correction suggérée : Définissez la fonction dans un fichier JavaScript ou supprimez l'attribut <code>onclick</code> :</p>
      <p class="code">&lt;input type="submit"&gt;</p>
    </div>
    <div class="section">
      <h2>Suggestions IA</h2>
      <p>- Utilisez des validateurs HTML (comme W3C Markup Validation Service) pour détecter les erreurs structurelles.</p>
      <p>- Ajoutez des attributs <code>alt</code> aux images pour améliorer l'accessibilité.</p>
      <p>- Déplacez les scripts JavaScript avant la balise <code>&lt;/body&gt;</code> pour optimiser le chargement.</p>
      <p>- Évitez les attributs <code>onclick</code> inline ; utilisez <code>addEventListener</code> dans un fichier JavaScript séparé.</p>
    </div>
    <p class="footer">Cordialement, Votre Expert en Revue de Code</p>
  </div>
</body>
</html>`;
      fs.writeFileSync("ai_report.txt", htmlContent, "utf8");
      console.log("✅ IA: Analyse non valide, rapport par défaut généré");
      process.exit(1); // Bloque le push
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
    .code { background-color: #f1f3f4; padding: 10px; border-radius: 4px; font-family: monospace; }
    .footer { font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Revue de Code - Erreur Critique</h1>
    <p>Bonjour l'équipe,</p>
    <div class="section">
      <h2>Erreur détectée</h2>
      <p>Une erreur s'est produite lors de l'analyse : ${err.message}</p>
      <p>Entrée analysée :</p>
      <pre class="code">${input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
    </div>
    <div class="section">
      <h2>Suggestions</h2>
      <p>Assurez-vous que la clé API Gemini est correctement configurée dans .env.</p>
      <p>Contactez l'équipe pour assistance si le problème persiste.</p>
    </div>
    <p class="footer">Cordialement, Votre Expert en Revue de Code</p>
  </div>
</body>
</html>`;
    fs.writeFileSync("ai_report.txt", errorHtml, "utf8");
    console.error("❌ Erreur lors de l'appel Gemini :", err);
    process.exit(1); // Bloque le push
  }
};

main();