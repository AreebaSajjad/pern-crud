const { getPullRequestFiles, setCommitStatus, postPRComment } = require('../utils/githubClient');
const { reviewDiff } = require('../utils/aiReviewer');
const { saveReview, getReviewHistory } = require('../utils/prReviewDb');

// GitHub se aane wala webhook event yahan handle hota hai
async function handleWebhook(req, res) {
  const event = req.headers['x-github-event'];

  // Sirf pull_request event mein interested hain
  if (event !== 'pull_request') {
    return res.status(200).json({ message: 'Event ignored' });
  }

  const { action, pull_request } = req.body;

  if (!['opened', 'synchronize', 'reopened'].includes(action)) {
    return res.status(200).json({ message: 'Action ignored' });
  }

  // GitHub ko turant 200 response de do - AI review background mein chalega
  res.status(200).json({ message: 'Review started' });

  const prNumber = pull_request.number;
  const prTitle = pull_request.title;
  const sha = pull_request.head.sha;
  const repo = `${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}`;

  try {
    // 1. Pending status - GitHub PR UI par "checks running" dikhega
    await setCommitStatus(sha, 'pending', 'AI review in progress...');

    // 2. PR ka diff fetch karo
    const files = await getPullRequestFiles(prNumber);

    // 3. AI se review karwao
    const { approved, feedback } = await reviewDiff(files);

    // 4. Result ko comment ke through PR par post karo
    await postPRComment(prNumber, `### 🤖 AI Code Review\n\n${feedback}`);

    // 5. Final status set karo - yehi merge button ko block/allow karta hai
    await setCommitStatus(
      sha,
      approved ? 'success' : 'failure',
      approved ? 'AI review passed' : 'AI review found issues - check PR comments'
    );

    // 6. Result database mein bhi save karo - frontend dashboard isi se data dikhayega
    await saveReview({
      repo,
      prNumber,
      prTitle,
      commitSha: sha,
      status: approved ? 'approved' : 'rejected',
      feedback,
    });
  } catch (err) {
    console.error('AI review failed:', err.message);
    await setCommitStatus(sha, 'error', 'AI review crashed - check server logs');

    // Error case bhi DB mein save karo, taake dashboard mein pata chale kahan fail hua
    await saveReview({
      repo,
      prNumber,
      prTitle,
      commitSha: sha,
      status: 'error',
      feedback: err.message,
    }).catch((dbErr) => console.error('Failed to save error review to DB:', dbErr.message));
  }
}

// Dashboard ke liye - saari saved AI reviews return karta hai
async function getHistory(req, res) {
  try {
    const history = await getReviewHistory();
    res.json(history);
  } catch (err) {
    console.error('Failed to fetch review history:', err.message);
    res.status(500).json({ message: 'Failed to fetch review history' });
  }
}

module.exports = { handleWebhook, getHistory };
