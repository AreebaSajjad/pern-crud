const { pool } = require('../config/pgDb');

// Ek AI review ka result DB mein save karta hai (webhook chalne ke baad)
async function saveReview({ repo, prNumber, prTitle, commitSha, status, feedback }) {
  await pool.query(
    `INSERT INTO pr_reviews (repo, pr_number, pr_title, commit_sha, status, feedback)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [repo, prNumber, prTitle, commitSha, status, feedback]
  );
}

// Dashboard ke liye saari saved reviews (latest pehle) return karta hai
async function getReviewHistory() {
  const result = await pool.query(
    `SELECT id, repo, pr_number, pr_title, commit_sha, status, feedback, created_at
     FROM pr_reviews
     ORDER BY created_at DESC
     LIMIT 100`
  );
  return result.rows;
}

module.exports = { saveReview, getReviewHistory };
