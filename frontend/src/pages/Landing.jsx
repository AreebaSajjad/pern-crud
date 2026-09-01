import { Link } from 'react-router-dom';

const Landing = () => {
  return (
    <div className="landing-page">

      {/* ================= HEADER ================= */}
      <header className="landing-header">
        <div className="header-container">

          <Link to="/" className="store-logo">
            <span>🛍️</span>
            <strong>MyStore</strong>
          </Link>

          <nav className="landing-nav">
            <a href="#home">Home</a>
            <a href="#features">Features</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </nav>

          <div className="header-actions">
            <Link to="/login" className="header-login">
              Login
            </Link>

            <Link to="/signup" className="header-signup">
              Sign Up
            </Link>
          </div>

        </div>
      </header>


      {/* ================= HERO ================= */}
      <section className="landing-hero" id="home">

        <div className="hero-container">

          <div className="hero-text">

            <span className="hero-badge">
              ✨ Smart Store Management
            </span>

            <h1>
              Manage Your Store
              <span> Smarter.</span>
            </h1>

            <p>
              MyStore makes it easy to manage products, orders,
              users, meetings, and more — all in one place.
            </p>

            <div className="hero-actions">

              <Link to="/signup" className="hero-primary">
                Get Started →
              </Link>

              <a href="#features" className="hero-secondary">
                Explore Features
              </a>

            </div>

            <div className="hero-benefits">
              <span>✓ Easy to use</span>
              <span>✓ Secure</span>
              <span>✓ AI Powered</span>
            </div>

          </div>


          {/* ================= HERO CARD ================= */}

          <div className="hero-card-wrapper">

            <div className="hero-card">

              <div className="card-header">
                <div className="mini-logo">
                  🛍️
                </div>

                <div>
                  <strong>MyStore</strong>
                  <small>Store Management</small>
                </div>

                <span className="status-dot"></span>
              </div>


              <div className="card-icon">
                🛒
              </div>

              <h3>
                Everything in One Place
              </h3>

              <p>
                Manage your store quickly and effortlessly.
              </p>


              <div className="card-features">

                <div>
                  <span>📦</span>
                  <strong>Products</strong>
                </div>

                <div>
                  <span>🛒</span>
                  <strong>Orders</strong>
                </div>

                <div>
                  <span>👥</span>
                  <strong>Users</strong>
                </div>

                <div>
                  <span>🤖</span>
                  <strong>AI Assistant</strong>
                </div>

              </div>

            </div>

          </div>

        </div>

      </section>


      {/* ================= FEATURES ================= */}

      <section className="features-section" id="features">

        <div className="section-title">

          <span>OUR FEATURES</span>

          <h2>
            Everything You Need
          </h2>

          <p>
            Powerful tools to keep your store organized and easy to manage.
          </p>

        </div>


        <div className="features-container">

          <div className="feature-card">

            <div className="feature-icon blue">
              📦
            </div>

            <h3>
              Product Management
            </h3>

            <p>
              Add, update and manage your products,
              prices, stock and images with ease.
            </p>

          </div>


          <div className="feature-card">

            <div className="feature-icon green">
              🛒
            </div>

            <h3>
              Order Management
            </h3>

            <p>
              Create and manage orders with simple
              and organized workflows.
            </p>

          </div>


          <div className="feature-card">

            <div className="feature-icon purple">
              📅
            </div>

            <h3>
              Meetings
            </h3>

            <p>
              Schedule meetings, participants and
              time slots easily.
            </p>

          </div>


          <div className="feature-card">

            <div className="feature-icon orange">
              🤖
            </div>

            <h3>
              AI Assistant
            </h3>

            <p>
              Ask questions and perform store actions
              using natural language.
            </p>

          </div>

        </div>

      </section>


      {/* ================= ABOUT ================= */}

      <section className="about-section" id="about">

        <div className="about-container">

          <div className="about-box">
            🛍️
          </div>

          <div className="about-text">

            <span>
              ABOUT MYSTORE
            </span>

            <h2>
              Your Store.
              <strong> Simplified.</strong>
            </h2>

            <p>
              MyStore is a complete store management platform
              designed to make your everyday tasks simple.
              Manage products, orders, users and meetings
              from one convenient place.
            </p>

            <div className="about-points">

              <div>
                ✓ Secure authentication
              </div>

              <div>
                ✓ Easy product & order management
              </div>

              <div>
                ✓ AI-powered assistant
              </div>

            </div>

          </div>

        </div>

      </section>


      {/* ================= CTA ================= */}

      <section className="landing-cta">

        <div className="cta-content">

          <div>
            <h2>
              Ready to manage your store?
            </h2>

            <p>
              Start using MyStore today.
            </p>
          </div>

          <Link to="/signup" className="cta-button">
            Get Started →
          </Link>

        </div>

      </section>


      {/* ================= FOOTER ================= */}

      <footer className="landing-footer" id="contact">

        <div className="footer-container">

          <div className="footer-brand">

            <Link to="/" className="store-logo">
              <span>🛍️</span>
              <strong>MyStore</strong>
            </Link>

            <p>
              A simple and smarter way to manage
              your store.
            </p>

          </div>


          <div className="footer-column">

            <h4>Product</h4>

            <a href="#features">Features</a>
            <a href="#about">About</a>
            <Link to="/login">Login</Link>
            <Link to="/signup">Sign Up</Link>

          </div>


          <div className="footer-column">

            <h4>Support</h4>

            <a href="#contact">Contact</a>
            <a href="#features">Features</a>
            <a href="#about">About Us</a>

          </div>


          <div className="footer-column">

            <h4>Connect</h4>

            <div className="social-icons">
              <span>f</span>
              <span>𝕏</span>
              <span>in</span>
              <span>✉</span>
            </div>

          </div>

        </div>


        <div className="footer-bottom">
          © 2026 MyStore. All rights reserved.
        </div>

      </footer>

    </div>
  );
};

export default Landing;