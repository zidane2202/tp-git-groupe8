import 'dotenv/config';
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import { execSync } from "child_process";

const ai = new GoogleGenAI({});

const main = async () => {
  let diff = "";
  try {
    diff = execSync("git diff --cached", { encoding: "utf8" });
  } catch (e) {
    console.error("❌ Impossible de lire le diff :", e);
  }

  if (!diff || diff.trim().length === 0) {
    fs.writeFileSync("ai_report.txt", "Aucun diff à analyser.", "utf8");
    process.exit(0);
  }

  const prompt = `
Tu es un assistant expert en analyse de code HTML, CSS et JavaScript.
Analyse ce diff et détecte les erreurs ou risques de sécurité.
Si tout est OK, écris "OK" sur la première ligne.
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
    console.error("Erreur IA :", err);
    fs.writeFileSync("ai_report.txt", "Erreur de communication avec l'API IA.", "utf8");
    process.exit(1);
  }
};

main();
