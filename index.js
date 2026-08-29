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

app.post('/api/send-bulk', async (req, res) => {
  const { senderEmail, appPassword, emails, subject, body } = req.body;

  if (!senderEmail || !appPassword || !emails || !Array.isArray(emails) || emails.length === 0 || !subject || !body) {
    return res.status(400).json({ success: false, message: 'All fields including Gmail ID & App Password are required.' });
  }

  // Frontend se bheje gaye Gmail credentials use ho rahe hain
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: senderEmail.trim(),
      pass: appPassword.trim().replace(/\s+/g, '') // Removes spaces from app password
    }
  });

  const results = { successful: [], failed: [] };

  for (const email of emails) {
    const cleanEmail = email.trim();
    if (!cleanEmail) continue;

    try {
      await transporter.sendMail({
        from: `"Sender" <${senderEmail.trim()}>`,
        to: cleanEmail,
        subject: subject,
        html: `<p>${body.replace(/\n/g, '<br/>')}</p>`
      });

      results.successful.push(cleanEmail);
      console.log(`Sent successfully to: ${cleanEmail}`);
    } catch (err) {
      console.error(`Failed for ${cleanEmail}:`, err.message);
      results.failed.push({ email: cleanEmail, error: err.message });
    }

    // 1.5 second safety delay
    await delay(1500);
  }

  return res.json({
    success: true,
    total: emails.length,
    sentCount: results.successful.length,
    failedCount: results.failed.length,
    results
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
