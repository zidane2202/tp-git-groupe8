import 'dotenv/config';
import nodemailer from 'nodemailer';
import { GoogleGenAI } from '@google/genai';
import { execSync } from 'child_process';

// --- Configuration ---
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

const DEFAULT_EMAIL = 'pythiemorne22@gmail.com';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// --- Fonctions d'aide ---
/**
 * Récupère l'adresse e-mail du committer ou utilise une valeur par défaut.
 * @returns {string} Adresse e-mail
 */
function getRecipientEmail() {
  if (process.env.NOTIFY_EMAILS) {
    return process.env.NOTIFY_EMAILS;
  }
  try {
    const email = execSync('git config user.email').toString().trim();
    console.log('📧 Adresse Git détectée :', email);
    return email;
  } catch (error) {
    console.log('⚠️ Impossible de récupérer l’e-mail Git, utilisation de l’e-mail par défaut :', DEFAULT_EMAIL);
    return DEFAULT_EMAIL;
  }
}

/**
 * Récupère le diff Git des fichiers modifiés.
 * @returns {string} Contenu du diff ou message par défaut
 */
function getGitDiff() {
  try {
    return execSync('git diff --cached').toString();
  } catch (error) {
    console.log('⚠️ Impossible de récupérer le diff Git :', error.message);
    return 'Aucun diff disponible.';
  }
}

/**
 * Génère le prompt pour l'IA avec le diff Git.
 * @param {string} diffText - Contenu du diff Git
 * @param {string} status - Statut du push (success/fail)
 * @returns {string} Prompt pour l'IA
 */
function generatePrompt(diffText, status) {
  return `
Tu es un expert en revue de code. Analyse le diff Git suivant et génère un e-mail professionnel en HTML complet pour un feedback sur le code. L'e-mail doit :
- Être esthétique, professionnel et convivial, avec des styles CSS en ligne (palette : bleu, vert, gris clair).
- Inclure un titre, une introduction, les résultats des linters (si pertinents), le diff Git, et des recommandations d'amélioration.
- Mentionner si le code est impeccable ou signaler les erreurs/suggestions avec des corrections précises (indiquer les lignes si possible).
- Être compatible avec tous les clients de messagerie (styles en ligne, pas de scripts externes).
- Avoir un sujet clair et adapté au statut du push (${status}).
- Commencer par "Objet : <sujet>" suivi du code HTML complet (<html>, <body>, etc.).

Diff Git :
${diffText}
`;
}

/**
 * Appelle l'API Google GenAI pour générer la revue de code en HTML.
 * @param {string} prompt - Prompt pour l'IA
 * @returns {Promise<string>} Contenu HTML de l'e-mail
 */
async function getAIReview(prompt) {
  try {
    const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    let htmlContent = response.text.trim();
    // Nettoyer les balises Markdown si présentes
    if (htmlContent.startsWith('```html')) {
      htmlContent = htmlContent.replace(/^```html\n|```$/g, '').trim();
    }
    return htmlContent;
  } catch (error) {
    console.error('❌ Erreur lors de la génération via Google GenAI :', error);
    return `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333; background-color: #f4f4f4; padding: 20px;">
          <h1 style="color: #d32f2f;">Erreur d'API Google GenAI</h1>
          <p>Impossible de générer la revue de code. Erreur : ${error.message}</p>
        </body>
      </html>
    `;
  }
}

/**
 * Extrait le sujet de l'e-mail à partir de la réponse de l'IA.
 * @param {string} aiContent - Contenu généré par l'IA
 * @returns {{ subject: string, html: string }} Sujet et corps HTML
 */
function extractSubjectAndHtml(aiContent) {
  const subjectMatch = aiContent.match(/Objet\s*:\s*(.+)/i);
  let subject = 'Revue de Code Automatisée - Analyse IA';
  let html = aiContent;

  if (subjectMatch) {
    subject = subjectMatch[1].trim();
    // Supprimer la ligne "Objet :" du contenu HTML
    html = aiContent.replace(/Objet\s*:\s*.+\n?/, '').trim();
  }

  return { subject, html };
}

/**
 * Envoie l'e-mail via Nodemailer.
 * @param {string} recipient - Adresse e-mail du destinataire
 * @param {string} subject - Sujet de l'e-mail
 * @param {string} htmlBody - Corps HTML de l'e-mail
 */
async function sendEmail(recipient, subject, htmlBody) {
  try {
    const transporter = nodemailer.createTransport(SMTP_CONFIG);
    const mailOptions = {
      from: `Git AI Bot <${SMTP_CONFIG.auth.user || DEFAULT_EMAIL}>`,
      to: recipient,
      subject,
      html: htmlBody,
    };

    await transporter.sendMail(mailOptions);
    console.log('📧 E-mail envoyé à', recipient);
  } catch (error) {
    console.error('❌ Erreur lors de l’envoi de l’e-mail :', error);
    console.log('\n--- Contenu HTML non envoyé (pour débogage) ---\n');
    console.log(htmlBody);
    console.log('\n----------------------------------------------------\n');
  }
}

// --- Logique principale ---
(async () => {
  console.log('🚀 Début de l’analyse du push...');

  // 1. Récupérer le statut du push
  const status = process.argv[2] || 'success';
  console.log('📊 Statut du push :', status);

  // 2. Récupérer l'adresse e-mail
  const recipientEmail = getRecipientEmail();

  // 3. Récupérer le diff Git
  const diffText = getGitDiff();

  // 4. Générer le prompt pour l'IA
  const prompt = generatePrompt(diffText, status);

  // 5. Obtenir la revue de l'IA
  const aiReview = await getAIReview(prompt);

  // 6. Extraire le sujet et le corps HTML
  const { subject, html } = extractSubjectAndHtml(aiReview);

  // 7. Envoyer l'e-mail
  await sendEmail(recipientEmail, subject, html);

  console.log('✅ Analyse et envoi terminés.');
})();