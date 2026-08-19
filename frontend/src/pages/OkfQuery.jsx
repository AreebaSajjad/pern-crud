import { useState } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';

const OkfQuery = () => {
  const [question, setQuestion] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    setError('');
    setReply('');
    setLoading(true);
    try {
      const res = await api.post('/okf/query', { message: question });
      setReply(res.data.reply);
    } catch (err) {
      setError(err.response?.data?.message || 'Query failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="dashboard-container">
        <h2>OKF Product Query</h2>
        <p className="auth-subtext">
          It directly reads the exact data from the product knowledge base (OKF Markdown files) and provides an answer.
        </p>

        <form onSubmit={handleAsk} className="form-group">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What is the price of Wireless Mouse?"
            style={{ marginBottom: '10px' }}
          />
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Asking...' : 'Ask'}
          </button>
        </form>

        {error && <p className="error-text">{error}</p>}
        {reply && (
          <div style={{ marginTop: '20px', padding: '16px', background: '#fff', borderRadius: '8px' }}>
            {reply}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default OkfQuery;
