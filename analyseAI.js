import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs/promises';
import path from 'path';

// Configuration sécurisée
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("❌ Erreur: GEMINI_API_KEY non défini dans les variables d'environnement.");
  process.exit(1);
}

// Initialisation du client Gemini
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Lecture de l'entrée standard (diff Git)
const readStdin = async () => {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
  });
};

// Génère un prompt structuré pour l'IA
const generatePrompt = (diff) => {
  return `
Tu es un expert en analyse de code HTML, CSS et JavaScript.
Analyse le diff Git ci-dessous (format git diff --cached) et produis un rapport d'analyse.
1) Identifie les erreurs de syntaxe, bugs potentiels ou risques de sécurité.
2) Fournis un rapport clair : fichiers concernés, lignes (si possible), description du problème.
3) Génère un e-mail professionnel en HTML complet (avec <html>, <head>, <body>) pour le développeur :
   - Objet : Résultat de l'analyse du code - <Résultat> (par ex. "Succès" ou "Problèmes détectés")
   - Corps : Explication claire, gravité des problèmes, suggestions de correction, liens utiles si pertinent.
   - Style : Utilise CSS en ligne pour un design professionnel, moderne et lisible (palette : bleu, vert, gris clair).
Si le code est impeccable, commence par "OK" et génère un e-mail de validation positif.

Diff Git :
${diff}
`;
};

// Fonction principale
const main = async () => {
  try {
    // Lecture du diff
    const diff = await readStdin();
    if (!diff || diff.trim().length === 0) {
      await fs.writeFile('ai_report.txt', 'Aucun diff à analyser.', 'utf8');
      console.log('✅ Aucun diff à analyser.');
      process.exit(0);
    }

    // Appel à l'API Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(generatePrompt(diff));
    const response = await result.response;
    let message = response.text;

    // Nettoyage si l'IA renvoie du markdown
    if (message.startsWith('```html')) {
      message = message.replace(/^```html\n|```$/g, '').trim();
    } else if (message.startsWith('```')) {
      message = message.replace(/^```\n|```$/g, '').trim();
    }

    // Écriture du rapport
    await fs.writeFile('ai_report.txt', message, 'utf8');

    // Vérification du statut
    if (/^\s*ok\b/i.test(message)) {
      console.log('✅ IA: Code OK');
      process.exit(0);
    } else {
      console.log('❌ IA: Problèmes détectés');
      console.log(message);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Erreur lors de l’analyse IA :', err.message);
    await fs.writeFile('ai_report.txt', `Erreur lors de l'analyse IA : ${err.message}`, 'utf8');
    process.exit(1);
  }
};

main();