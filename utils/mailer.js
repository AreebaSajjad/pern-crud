const nodemailer = require('nodemailer');

// SMTP config .env se aati hai. Gmail use karna ho to:
// SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_USER=your@gmail.com,
// SMTP_PASS = Gmail "App Password" (normal Gmail password kaam nahi karega,
// Google Account -> Security -> 2-Step Verification -> App Passwords se banayen)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: Number(process.env.SMTP_PORT) === 465, // 465 = SSL, 587 = TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async ({ to, subject, html }) => {
  await transporter.sendMail({
    from: `"${process.env.COMPANY_NAME || 'Our App'}" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
};

module.exports = { sendEmail };
