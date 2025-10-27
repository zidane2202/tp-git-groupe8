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
    fs.writeFileSync("ai_report.txt", "Aucun diff à analyser.", "utf8");
    process.exit(0);
  }

  const prompt = `
Tu es un assistant expert en analyse de code HTML, CSS et JavaScript.
Tu vas analyser le diff ci-dessous (format git diff --cached).
1) Indique si le code contient des erreurs de syntaxe, bugs évidents, ou risques de sécurité.
2) Fournis un rapport clair : fichiers concernés, lignes (si possible), description du problème.
3) Rédige ensuite un e-mail professionnel à envoyer au développeur :
   - objet (ligne)
   - corps du message (explication, gravité, suggestion de correction, liens utiles si pertinent)
Si tout est OK, écris "OK" sur la première ligne puis un e-mail de validation.
Diff :
${diff}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const message = response.text;
    fs.writeFileSync("ai_report.txt", message, "utf8");

    if (/^\s*ok\b/i.test(message)) {
      console.log("✅ IA: OK");
      process.exit(0);
    } else {
      console.log("❌ IA: problèmes détectés par l'IA");
      console.log(message);
      process.exit(1);
    }
  } catch (err) {
    console.error("Erreur lors de l'appel Gemini :", err);
    fs.writeFileSync("ai_report.txt", "Erreur de communication avec l'API IA.", "utf8");
    process.exit(1);
  }
};

main();
