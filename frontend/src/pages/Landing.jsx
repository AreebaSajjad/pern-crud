import { Link } from 'react-router-dom';

const Landing = () => {
  return (
    <div className="landing-container">
      <div className="landing-icon">🛍️</div>
      <h1>Welcome to Our Store</h1>
      <p>Manage products, users, and more — all in one place.</p>
      <div className="landing-buttons">
        <Link to="/login" className="landing-btn btn-primary">Login</Link>
        <Link to="/signup" className="landing-btn btn-secondary">Sign Up</Link>
      </div>
    </div>
  );
};

export default Landing;