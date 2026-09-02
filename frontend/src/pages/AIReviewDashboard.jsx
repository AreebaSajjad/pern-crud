import { useEffect, useState } from 'react';
import api from '../services/api';

const statusStyles = {
  approved: { background: '#e6f4ea', color: '#1e7e34', label: 'Approved' },
  rejected: { background: '#fdecea', color: '#c62828', label: 'Rejected' },
  error: { background: '#fff4e5', color: '#b25000', label: 'Error' },
};

export default function AIReviewDashboard() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const fetchHistory = async () => {
      try {
        const res = await api.get('/github-review/history');
        if (isMounted) setReviews(res.data);
      } catch (err) {
        if (isMounted) setError('Failed to load AI review history.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Loading AI review history...</div>;
  if (error) return <div style={{ padding: 24, color: '#c62828' }}>{error}</div>;

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>AI Code Review History</h2>

      {reviews.length === 0 ? (
        <p>No PR reviews yet. Open a pull request on GitHub to see results here.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reviews.map((review) => {
            const style = statusStyles[review.status] || statusStyles.error;
            return (
              <div
                key={review.id}
                style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <div>
                    <strong>
                      #{review.pr_number} — {review.pr_title || 'Untitled PR'}
                    </strong>
                    <div style={{ fontSize: 13, color: '#666' }}>
                      {review.repo} · {new Date(review.created_at).toLocaleString()}
                    </div>
                  </div>
                  <span
                    style={{
                      background: style.background,
                      color: style.color,
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {style.label}
                  </span>
                </div>
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    background: '#fafafa',
                    padding: 12,
                    borderRadius: 6,
                    margin: 0,
                  }}
                >
                  {review.feedback}
                </pre>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
