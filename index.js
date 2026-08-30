const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function resolveSpintax(text) {
  const regex = /\{([^{}]+)\}/g;
  while (regex.test(text)) {
    text = text.replace(regex, (match, choices) => {
      const opts = choices.split('|');
      return opts[Math.floor(Math.random() * opts.length)];
    });
  }
  return text;
}

app.post('/api/send-batch', async (req, res) => {
  const { senderName, senderEmail, appPassword, emails, subject, body } = req.body;

  if (!senderEmail || !appPassword || !emails || !Array.isArray(emails) || emails.length === 0 || !subject || !body) {
    return res.status(400).json({ success: false, message: 'All fields required' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    pool: true,
    maxConnections: 6,
    auth: {
      user: senderEmail.trim(),
      pass: appPassword.trim().replace(/\s+/g, '')
    }
  });

  const successful = [];
  const failed = [];
  const BATCH_SIZE = 6;

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (rawEmail) => {
        const cleanEmail = rawEmail.trim();
        if (!cleanEmail) return;

        try {
          const dynamicSubject = resolveSpintax(subject);
          let dynamicBody = resolveSpintax(body);
          const namePart = cleanEmail.split('@')[0];
          dynamicBody = dynamicBody.replace(/\{name\}/gi, namePart);

          await transporter.sendMail({
            from: `"${senderName ? senderName.trim() : 'Sender'}" <${senderEmail.trim()}>`,
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

    if (i + BATCH_SIZE < emails.length) {
      await delay(1000);
    }
  }

  return res.json({
    success: true,
    total: emails.length,
    sentCount: successful.length,
    failedCount: failed.length
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server started on port ${PORT}`);
});
