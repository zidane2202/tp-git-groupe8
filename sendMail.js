import 'dotenv/config';
import nodemailer from 'nodemailer';
import fs from 'fs/promises';

// Exécuté dans une IIFE async pour une gestion propre des opérations asynchrones
(async () => {
  // --- 1️⃣ Configuration et validation des variables d'environnement ---
  const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
  const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;

  if (!SMTP_USER || !SMTP_PASS) {
    console.error('❌ Erreur: SMTP_USER ou SMTP_PASS non défini.');
    process.exit(1);
  }

  // --- 2️⃣ Récupération des adresses e-mails ---
  let toEmails;
  if (process.env.NOTIFY_EMAILS) {
    toEmails = process.env.NOTIFY_EMAILS.split(',').map((email) => email.trim());
  } else {
    toEmails = ['pythiemorne22@gmail.com'];
    console.log('⚠️ Utilisation de l’e-mail par défaut :', toEmails);
  }

  // --- 3️⃣ Lecture du rapport IA généré par analyseAI.js ---
  let aiMailContent;
  try {
    aiMailContent = await fs.readFile('ai_report.txt', 'utf8');
  } catch (err) {
    console.error('❌ Erreur lors de la lecture de ai_report.txt :', err.message);
    aiMailContent = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333; padding: 20px;">
          <h1 style="color: #d32f2f;">Erreur d'Analyse</h1>
          <p>Impossible de récupérer le rapport d'analyse IA. Veuillez vérifier les logs.</p>
        </body>
      </html>`;
  }

  // --- 4️⃣ Extraction de l'objet et du corps de l'e-mail ---
  let subject = 'Résultat de l’Analyse du Code';
  let htmlBody = aiMailContent;

  // Extraction de l'objet si présent dans le contenu IA
  const objMatch = aiMailContent.match(/Objet\s*:\s*(.+)/i);
  if (objMatch) {
    subject = objMatch[1].trim();
    // Supprimer la ligne "Objet : ..." du corps pour éviter de l'afficher dans l'e-mail
    htmlBody = aiMailContent.replace(/Objet\s*:\s*.+\n?/, '');
  }

  // Vérification que le contenu est un HTML valide
  if (!htmlBody.includes('<html') || !htmlBody.includes('<body')) {
    htmlBody = `
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${subject}</title>
        </head>
        <body style="font-family: Arial, sans-serif; color: #333; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #1976d2;">Rapport d'Analyse de Code</h1>
            <p>${htmlBody.replace(/\n/g, '<br>')}</p>
            <p style="color: #388e3c;">Merci de vérifier les suggestions et d'effectuer les corrections nécessaires.</p>
            <hr style="border: 0; border-top: 1px solid #eee;">
            <p style="font-size: 12px; color: #777;">Ce message a été généré automatiquement par Git AI Bot.</p>
          </div>
        </body>
      </html>`;
  }

  // --- 5️⃣ Configuration du transporteur SMTP ---
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // SSL pour le port 465, TLS pour le port 587
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  // --- 6️⃣ Préparation et envoi du mail ---
  const mailOptions = {
    from: `Git AI Bot <${SMTP_USER}>`,
    to: toEmails,
    subject,
    html: htmlBody, // Utilisation de html au lieu de text pour un rendu correct
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('📧 E-mail envoyé à', toEmails.join(', '));
  } catch (err) {
    console.error('❌ Erreur lors de l’envoi de l’e-mail :', err.message);
    process.exit(1);
  }
})();