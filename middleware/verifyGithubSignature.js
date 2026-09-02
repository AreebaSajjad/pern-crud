const crypto = require('crypto');

function verifyGithubSignature(req, res, next) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret) {
    console.error('GITHUB_WEBHOOK_SECRET is not set in .env');
    return res.status(500).json({ message: 'Server misconfigured' });
  }

  const signature = req.headers['x-hub-signature-256'];

  if (!signature || !req.rawBody) {
    return res.status(401).json({ message: 'Missing signature' });
  }

  const expected =
    'sha256=' + crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    return res.status(401).json({ message: 'Invalid signature' });
  }

  next();
}

module.exports = verifyGithubSignature;