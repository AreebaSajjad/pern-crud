const express = require('express');
const router = express.Router();
const verifyGithubSignature = require('../middleware/verifyGithubSignature');
const { handleWebhook } = require('../controllers/githubReviewController');

router.post('/webhook', verifyGithubSignature, handleWebhook);

module.exports = router;
