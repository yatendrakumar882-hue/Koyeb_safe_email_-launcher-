const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1 बैच के बाद 1 सेकंड का सेफ डिले
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Spintax Resolver: {Hi|Hello|Hey} -> Random choice
function resolveSpintax(text) {
  const spintaxRegex = /\{([^{}]+)\}/g;
  while (spintaxRegex.test(text)) {
    text = text.replace(spintaxRegex, (match, choices) => {
      const options = choices.split('|');
      return options[Math.floor(Math.random() * options.length)];
    });
  }
  return text;
}

app.post('/api/send-batch', async (req, res) => {
  const { senderName, senderEmail, appPassword, emails, subject, body } = req.body;

  if (!senderEmail || !appPassword || !emails || !Array.isArray(emails) || emails.length === 0 || !subject || !body) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    pool: true,
    maxConnections: 6, // 6 parallel connections
    auth: {
      user: senderEmail.trim(),
      pass: appPassword.trim().replace(/\s+/g, '')
    }
  });

  const successful = [];
  const failed = [];
  const BATCH_SIZE = 6; // 1 बैच में 6 ईमेल

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);

    // 6 ईमेल को एक साथ (Parallel) प्रोसेस करना
    await Promise.all(
      batch.map(async (rawEmail) => {
        const cleanEmail = rawEmail.trim();
        if (!cleanEmail) return;

        try {
          const dynamicSubject = resolveSpintax(subject);
          let dynamicBody = resolveSpintax(body);
          
          // Name tag replace
          const namePart = cleanEmail.split('@')[0];
          dynamicBody = dynamicBody.replace(/\{name\}/gi, namePart);

          await transporter.sendMail({
            from: `"${senderName ? senderName.trim() : 'Notification'}" <${senderEmail.trim()}>`,
            to: cleanEmail,
            subject: dynamicSubject,
            html: dynamicBody.includes('<') ? dynamicBody : `<p>${dynamicBody.replace(/\n/g, '<br/>')}</p>`
          });

          successful.push(cleanEmail);
        } catch (err) {
          failed.push({ email: cleanEmail, error: err.message });
        }
      })
    );

    // बैच के बीच 1 सेकंड का गैप
    if (i + BATCH_SIZE < emails.length) {
      await delay(1000);
    }
  }

  return res.json({
    success: true,
    total: emails.length,
    sentCount: successful.length,
    failedCount: failed.length,
    failed
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
