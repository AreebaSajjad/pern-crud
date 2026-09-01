// Tumhare existing utils/openaiClient.js ka getChatCompletion reuse kar rahe hain -
// ek hi jagah se OpenAI calls jaa rahi hain, koi duplicate client nahi bana
const { getChatCompletion } = require('./openaiClient');

const MAX_DIFF_CHARS = 12000; // token/cost limit ke liye diff ko cap karte hain

const SYSTEM_PROMPT = `You are a senior code reviewer for a PERN stack (PostgreSQL, Express, React, Node.js) e-commerce project.
Review the given git diff carefully for:
- Bugs and logic errors
- Security issues (SQL injection, missing auth checks, exposed secrets, broken access control)
- Bad practices specific to Express/PostgreSQL/React

Respond in this EXACT format:
STATUS: APPROVE
or
STATUS: REJECT

Then, on new lines, give a short bullet-point list of issues found (if any) and suggested fixes.
If APPROVE, minor suggestions are fine but must not block merging.
Only use REJECT for real bugs or security issues, not for style preferences.`;

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
