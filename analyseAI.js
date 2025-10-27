import 'dotenv/config'; // charge automatiquement les variables depuis .env

import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

// Définir le chemin absolu pour le rapport
const REPORT_PATH = path.resolve(process.cwd(), "ai_report.html");

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
  if (!diff || diff.trim().length === 0) {
    // Si pas de diff, on écrit un rapport vide et on sort avec succès
    fs.writeFileSync(REPORT_PATH, "<!DOCTYPE html><html><head><title>Revue de Code Impeccable - Aucun Changement</title></head><body><h1>Aucun changement à analyser.</h1><p>Le push a été validé car aucun fichier n'a été modifié.</p></body></html>", "utf8");
    console.error("✅ IA: OK - Aucun diff à analyser.");
    // IMPORTANT : Afficher le chemin du rapport sur stdout pour que le script appelant puisse le récupérer
    console.log(REPORT_PATH); 
    process.exit(0);
  }

  const prompt = `
Vous êtes un expert en revue de code. Votre tâche est d'analyser le diff ci-dessous (format git diff --cached),
en vous concentrant sur la qualité, la cohérence, les erreurs potentielles et les améliorations.
Après l'analyse, vous devez générer une réponse **uniquement** sous forme de code HTML complet et esthétique
pour un e-mail de feedback. L'e-mail doit être très beau, professionnel et convivial.
Si le code est impeccable, générez un HTML de validation. S'il y a des erreurs ou des suggestions, mentionnez-les clairement,
en indiquant les lignes si possible, et proposez des corrections.
Le code HTML doit être complet (avec <html>, <body>, etc.) et utiliser des styles en ligne (CSS)
pour garantir un bon affichage dans tous les clients de messagerie. Utilisez une palette de couleurs agréable (par exemple, bleu, vert, gris clair).
Le sujet de l'email doit être inclus dans une balise <title> dans le <head> du HTML.

Diff :
${diff}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    let htmlContent = response.text.trim();
    
    // Tentative d'extraction du bloc de code si l'IA l'a mis dans des balises markdown
    if (htmlContent.startsWith("```html")) {
        htmlContent = htmlContent.replace("```html", "").replace("```", "").trim();
    }
    
    // Le rapport est maintenant un fichier HTML
    fs.writeFileSync(REPORT_PATH, htmlContent, "utf8");

    // On cherche le titre dans le HTML pour déterminer le statut
    const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : "";

    // IMPORTANT : Afficher le chemin du rapport sur stdout pour que le script appelant puisse le récupérer
    console.log(REPORT_PATH); 

    if (title.toLowerCase().includes("impeccable") || title.toLowerCase().includes("validé") || title.toLowerCase().includes("ok")) {
      console.error("✅ IA: OK - Revue de code impeccable.");
      process.exit(0);
    } else {
      console.error("❌ IA: problèmes détectés - Revue de code requise.");
      console.error("\n--- Contenu HTML du rapport ---\n" + htmlContent + "\n-------------------------------\n");
      process.exit(1);
    }
  } catch (err) {
    console.error("Erreur lors de l'appel Gemini :", err);
    fs.writeFileSync(REPORT_PATH, `<!DOCTYPE html><html><head><title>Erreur Critique API IA</title></head><body><h1>Erreur de communication avec l'API IA.</h1><p>${err.message}</p></body></html>`, "utf8");
    // IMPORTANT : Afficher le chemin du rapport sur stdout pour que le script appelant puisse le récupérer
    console.log(REPORT_PATH); 
    process.exit(1);
  }
};

main();

