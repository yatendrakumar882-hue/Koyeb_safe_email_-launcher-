const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Delay utility to protect Gmail account from getting blocked
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.post('/api/send-bulk', async (req, res) => {
  const { emails, subject, body } = req.body;

  if (!emails || !Array.isArray(emails) || emails.length === 0 || !subject || !body) {
    return res.status(400).json({ success: false, message: 'Invalid payload. All fields required.' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASS
    }
  });

  const results = { successful: [], failed: [] };

  // Run in background and respond immediately or wait based on queue length
  for (const email of emails) {
    const cleanEmail = email.trim();
    if (!cleanEmail) continue;

    try {
      await transporter.sendMail({
        from: `"Notification" <${process.env.GMAIL_USER}>`,
        to: cleanEmail,
        subject: subject,
        html: `<p>${body.replace(/\n/g, '<br/>')}</p>`
      });

      results.successful.push(cleanEmail);
      console.log(`Sent to: ${cleanEmail}`);
    } catch (err) {
      console.error(`Failed for ${cleanEmail}:`, err.message);
      results.failed.push({ email: cleanEmail, error: err.message });
    }

    // 1.5 second gap between each email
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
