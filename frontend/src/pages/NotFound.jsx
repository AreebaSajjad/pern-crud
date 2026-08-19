import { useNavigate } from 'react-router-dom';

const NotFound = () => {
  const navigate = useNavigate();
  return (
    <div className="notfound-container">
      <h1>404</h1>
      <p>The page you're looking for doesn't exist.</p>
      <button className="btn-primary" style={{ width: 'auto', padding: '12px 30px' }} onClick={() => navigate('/dashboard')}>
        Go to Dashboard
      </button>
    </div>
  );
};

export default NotFound;