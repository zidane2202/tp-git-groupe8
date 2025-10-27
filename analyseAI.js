import 'dotenv/config'; // charge automatiquement les variables depuis .env

import { GoogleGenAI } from "@google/genai";
import fs from "fs";

// Le client lit la clé API depuis la variable d'environnement GEMINI_API_KEY
const ai = new GoogleGenAI({});

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
    fs.writeFileSync("ai_report.html", "<h1>Aucun changement à analyser.</h1>", "utf8");
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
    fs.writeFileSync("ai_report.html", htmlContent, "utf8");

    // On cherche le titre dans le HTML pour déterminer le statut
    // Si le titre contient "impeccable", "validé", "ok" ou similaire, on considère que c'est un succès.
    const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : "";

    if (title.toLowerCase().includes("impeccable") || title.toLowerCase().includes("validé") || title.toLowerCase().includes("ok")) {
      console.log("✅ IA: OK - Revue de code impeccable.");
      process.exit(0);
    } else {
      console.log("❌ IA: problèmes détectés - Revue de code requise.");
      // On affiche le contenu pour le débogage si l'utilisateur exécute le script en local
      console.log("\n--- Contenu HTML du rapport ---\n" + htmlContent + "\n-------------------------------\n");
      process.exit(1);
    }
  } catch (err) {
    console.error("Erreur lors de l'appel Gemini :", err);
    fs.writeFileSync("ai_report.html", `<h1>Erreur de communication avec l'API IA.</h1><p>${err.message}</p>`, "utf8");
    process.exit(1);
  }
};

main();

