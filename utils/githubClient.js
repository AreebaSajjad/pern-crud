const GITHUB_API_URL = 'https://api.github.com';

function headers() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

// PR ke saare changed files + unka diff (patch) fetch karta hai
async function getPullRequestFiles(prNumber) {
  const { GITHUB_OWNER, GITHUB_REPO } = process.env;
  const res = await fetch(
    `${GITHUB_API_URL}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls/${prNumber}/files?per_page=100`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(`Failed to fetch PR files: ${await res.text()}`);
  return res.json();
}

// Commit par status set karta hai (pending/success/failure/error) - isi se
// branch protection merge ko block ya allow karta hai
async function setCommitStatus(sha, state, description, context = 'ai-code-review') {
  const { GITHUB_OWNER, GITHUB_REPO } = process.env;
  const url = `${GITHUB_API_URL}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/statuses/${sha}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, description, context }),
  });
  if (!res.ok) throw new Error(`Failed to set commit status: ${await res.text()}`);
  return res.json();
}


// PR par AI ka feedback comment ke through post karta hai
async function postPRComment(prNumber, body) {
  const { GITHUB_OWNER, GITHUB_REPO } = process.env;
  const res = await fetch(
    `${GITHUB_API_URL}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${prNumber}/comments`,
    {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    }
  );
  if (!res.ok) throw new Error(`Failed to post PR comment: ${await res.text()}`);
  return res.json();
}

module.exports = { getPullRequestFiles, setCommitStatus, postPRComment };
