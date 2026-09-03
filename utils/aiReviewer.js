// Tumhare existing utils/openaiClient.js ka getChatCompletion reuse kar rahe hain -
// ek hi jagah se OpenAI calls jaa rahi hain, koi duplicate client nahi bana
const fs = require('fs');
const path = require('path');
const { getChatCompletion } = require('./openaiClient');

const MAX_DIFF_CHARS = 12000; // token/cost limit ke liye diff ko cap karte hain

// System prompt ab code mein hardcoded nahi - ek alag file mein hai jo maintain karna
// aasan hai (edit karne ke liye code touch nahi karna, sirf ye .md file change karo).
// File ek hi baar server start hote waqt padhi jati hai aur memory mein cache ho jati hai.
const INSTRUCTIONS_PATH = path.join(__dirname, '../config/aiReviewInstructions.md');
const SYSTEM_PROMPT = fs.readFileSync(INSTRUCTIONS_PATH, 'utf8');

function buildDiffText(files) {
  let combined = '';
  for (const file of files) {
    if (!file.patch) continue; // binary files (images etc) ka patch nahi hota
    combined += `\n--- ${file.filename} ---\n${file.patch}\n`;
  }
  if (combined.length > MAX_DIFF_CHARS) {
    combined = combined.slice(0, MAX_DIFF_CHARS) + '\n\n[...diff truncated due to size...]';
  }
  return combined;
}

async function reviewDiff(files) {
  const diffText = buildDiffText(files);

  if (!diffText.trim()) {
    return {
      approved: true,
      feedback: 'No reviewable code changes found (only binary/asset files changed).',
    };
  }

  const aiResponse = await getChatCompletion(SYSTEM_PROMPT, `Here is the diff:\n${diffText}`);
  const approved = aiResponse.trim().startsWith('STATUS: APPROVE');

  return { approved, feedback: aiResponse };
}

module.exports = { reviewDiff };
