const crypto = require('crypto');

// GitHub webhook ka payload authentic hai ya nahi ye check karta hai - isse koi
// bhi bandaa fake request bhej ke hamara AI review ya merge status trigger nahi kar sakta
function verifyGithubSignature(req, res, next) {
  const signature = req.headers['x-hub-signature-256'];
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
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
