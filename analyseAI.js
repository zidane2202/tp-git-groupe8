import 'dotenv/config';
import { GoogleGenAI } from "@google/genai";
import fs from "fs";

// Le client lit la clé API depuis la variable d'environnement GEMINI_API_KEY
const ai = new GoogleGenAI({});

/**
 * Lit le contenu de stdin (le diff).
 * @returns {Promise<string>} Le contenu lu.
 */
const readStdin = async () => {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => data += chunk);
    process.stdin.on("end", () => resolve(data));
  });
};

/**
 * Génère le prompt pour l'analyse de code et la création de l'e-mail HTML.
 * @param {string} diff - Le contenu du diff Git.
 * @returns {string} Le prompt complet.
 */
export const generateHtmlEmailPrompt = (diff) => {
  return `
Vous êtes un expert en revue de code. Votre tâche est d'analyser les changements de code suivants,
en vous concentrant sur la qualité, la cohérence, les erreurs potentielles et les améliorations.
Après l'analyse, vous devez générer une réponse **uniquement** sous forme de code HTML complet et esthétique
pour un e-mail de feedback. L'e-mail doit être très beau, professionnel et convivial.
Si le code est impeccable, dites-le. S'il y a des erreurs ou des suggestions, mentionnez-les clairement,
en indiquant les lignes si possible, et proposez des corrections.

Le code HTML doit être complet (avec <html>, <body>, etc.) et utiliser des styles en ligne (CSS)
pour garantir un bon affichage dans tous les clients de messagerie. Utilisez une palette de couleurs agréable (par exemple, bleu, vert, gris clair).
Le sujet de l'e-mail doit être la première ligne du contenu, précédée de "Sujet : ".

--- Diff à Analyser ---
${diff}
`;
};

/**
 * Appelle l'API Gemini pour obtenir la revue de code HTML.
 * @param {string} prompt - Le prompt à envoyer à l'IA.
 * @returns {Promise<string>} Le contenu HTML généré par l'IA.
 */
export const getAiReview = async (prompt) => {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    // L'IA est instruite de renvoyer uniquement le code HTML
    let html_content = response.text.trim();
    if (html_content.startsWith("```html")) {
        html_content = html_content.replace(/^```html\s*/, "").replace(/\s*```$/, "").trim();
    }
    
    return html_content;
};


const main = async () => {
  const diff = await readStdin();
  if (!diff || diff.trim().length === 0) {
    fs.writeFileSync("ai_report.txt", "Aucun diff à analyser.", "utf8");
    process.exit(0);
  }

  const prompt = generateHtmlEmailPrompt(diff);
  
  try {
    const html_review = await getAiReview(prompt);
    
    // Le rapport complet (sujet + HTML) est écrit dans ai_report.txt
    fs.writeFileSync("ai_report.txt", html_review, "utf8");

    // On vérifie si l'IA a généré un sujet, sinon on utilise un sujet par défaut
    const subjectMatch = html_review.match(/^Sujet\s*:\s*(.+)/im);
    const subject = subjectMatch ? subjectMatch[1].trim() : "Revue de Code Automatisée";

    // Afficher le sujet pour le script appelant (par exemple, un script shell)
    console.log(subject);
    
    // Le script se termine avec succès si le rapport a été généré
    process.exit(0);

  } catch (err) {
    console.error("Erreur lors de l'appel Gemini :", err);
    fs.writeFileSync("ai_report.txt", "Erreur de communication avec l'API IA.", "utf8");
    process.exit(1);
  }
};

// Exécute la fonction main si le script est appelé directement
if (process.argv[1] === fs.realpathSync(__filename)) {
    main();
}

