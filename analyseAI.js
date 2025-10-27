import 'dotenv/config'; 
import { GoogleGenAI } from "@google/genai";
import fs from "fs";

// Le client lit la clé API depuis la variable d'environnement GEMINI_API_KEY
const ai = new GoogleGenAI({});

// Fonction pour lire le contenu de l'entrée standard (le diff)
const readStdin = async () => {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => data += chunk);
    process.stdin.on("end", () => resolve(data));
  });
};

const main = async () => {
  const diff = await readStdin();
  
  // Si aucun diff n'est fourni, on sort proprement.
  if (!diff || diff.trim().length === 0) {
    fs.writeFileSync("ai_report.html", "<h1>Aucun changement à analyser.</h1><p>Le push est considéré comme valide.</p>", "utf8");
    console.log("✅ IA: OK (Aucun diff)");
    process.exit(0);
  }

  const prompt = `
Vous êtes un expert en revue de code. Votre tâche est d'analyser les changements de code suivants (format git diff --cached), 
en vous concentrant sur la qualité, la cohérence, les erreurs potentielles et les améliorations. 
Après l'analyse, vous devez générer une réponse **uniquement** sous forme de code HTML complet et esthétique 
pour un e-mail de feedback. L'e-mail doit être très beau, professionnel et convivial. 

- Si le code est impeccable, le titre principal de l'email doit être "✅ Revue de Code Automatisée : Succès".
- S'il y a des erreurs ou des suggestions, le titre principal doit être "❌ Revue de Code Automatisée : Problèmes Détectés". Mentionnez-les clairement, 
en indiquant les lignes si possible, et proposez des corrections.
- Le code HTML doit être complet (avec <html>, <body>, etc.) et utiliser des styles en ligne (CSS) 
pour garantir un bon affichage dans tous les clients de messagerie. Utilisez une palette de couleurs agréable (par exemple, bleu, vert, gris clair).

--- Diff à Analyser ---
${diff}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Modèle rapide et efficace
      contents: prompt,
    });

    let html_content = response.text.trim();
    
    // Tentative d'extraction du bloc de code si l'IA l'a mis dans des balises markdown
    if (html_content.startsWith("```html")) {
        html_content = html_content.replace(/^```html\s*/, '').replace(/\s*```$/, '').trim();
    }
    
    // Écrire le rapport HTML dans un fichier
    fs.writeFileSync("ai_report.html", html_content, "utf8");

    // Pour déterminer l'état de sortie, on cherche un indicateur de succès dans le HTML
    // On considère que s'il y a le mot "Succès" ou "Impeccable" dans le HTML, c'est un succès.
    // Sinon, on considère qu'il y a des problèmes.
    const isSuccess = html_content.includes("Succès") || html_content.includes("impeccable");

    if (isSuccess) {
      console.log("✅ IA: OK (Revue positive)");
      process.exit(0);
    } else {
      console.log("❌ IA: Problèmes/Suggestions détectés");
      process.exit(1);
    }
  } catch (err) {
    console.error("Erreur lors de l'appel Gemini :", err);
    // En cas d'erreur API, on crée un rapport d'erreur pour l'email
    const errorHtml = `
      <html><body>
        <h1 style="color: red;">Erreur de Communication avec l'IA</h1>
        <p>Impossible d'obtenir la revue de code. Veuillez vérifier la clé API et la configuration.</p>
        <p>Détails de l'erreur: ${err.message}</p>
      </body></html>
    `;
    fs.writeFileSync("ai_report.html", errorHtml, "utf8");
    process.exit(1);
  }
};

main();
