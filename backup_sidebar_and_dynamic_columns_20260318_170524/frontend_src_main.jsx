import './styles.css';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';

import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import ReconciliationPage from './pages/ReconciliationPage';
import TransactionsPage from './pages/TransactionsPage';
import CalculatorPage from './pages/CalculatorPage';
import AlertsPage from './pages/AlertsPage';

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('adam_test@example.com');
  const [password, setPassword] = useState('TestPassword123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      let data = {};
      try {
        data = await response.json();
      } catch (err) {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data.message || `Login failed (${response.status})`);
      }

      const token = data.access_token || data.token || data.jwt;
      if (!token) {
        throw new Error('Login succeeded but no token was returned.');
      }

      localStorage.setItem('token', token);
      onLogin(token);
    } catch (err) {
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #111827 45%, #1f2937 100%)',
      padding: 24
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: 'rgba(17, 24, 39, 0.95)',
        border: '1px solid #374151',
        borderRadius: 18,
        padding: 28,
        boxShadow: '0 20px 40px rgba(0,0,0,0.35)'
      }}>
        <h1 style={{ color: '#f9fafb', marginTop: 0, marginBottom: 8, fontSize: 28 }}>
          Precious Metals Tracker
        </h1>
        <p style={{ color: '#9ca3af', marginTop: 0, marginBottom: 20 }}>
          Sign in to access your dashboard
        </p>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: 14 }}>
            <div style={{ color: '#d1d5db', marginBottom: 6 }}>Email</div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid #4b5563',
                background: '#111827',
                color: '#f9fafb',
                boxSizing: 'border-box'
              }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 18 }}>
            <div style={{ color: '#d1d5db', marginBottom: 6 }}>Password</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid #4b5563',
                background: '#111827',
                color: '#f9fafb',
                boxSizing: 'border-box'
              }}
            />
          </label>

          {error ? (
            <div style={{
              background: 'rgba(127, 29, 29, 0.35)',
              color: '#fecaca',
              border: '1px solid #7f1d1d',
              borderRadius: 10,
              padding: '10px 12px',
              marginBottom: 14,
              fontSize: 14
            }}>
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 10,
              border: 'none',
              background: loading ? '#6b7280' : '#d97706',
              color: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              fontSize: 15
            }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div style={{ marginTop: 18, color: '#9ca3af', fontSize: 12, lineHeight: 1.6 }}>
          Default test login:
          <br />
          adam_test@example.com
          <br />
          TestPassword123!
        </div>
      </div>
    </div>
  );
}

function AppShell({ onLogout }) {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#e5e7eb' }}>
        <aside style={{
          width: 230,
          background: 'linear-gradient(180deg, #020617 0%, #111827 100%)',
          color: 'white',
          padding: 18
        }}>
          <h1 style={{ fontSize: 28, lineHeight: 1.1, marginTop: 24, marginBottom: 28 }}>
            Metals Tracker
          </h1>

          <nav style={{ display: 'grid', gap: 10 }}>
            <NavLink to="/" style={{ color: 'white', textDecoration: 'none', padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.08)' }}>Dashboard</NavLink>
            <NavLink to="/upload" style={{ color: 'white', textDecoration: 'none', padding: '10px 12px' }}>Upload</NavLink>
            <NavLink to="/reconciliation" style={{ color: 'white', textDecoration: 'none', padding: '10px 12px' }}>Reconciliation</NavLink>
            <NavLink to="/transactions" style={{ color: 'white', textDecoration: 'none', padding: '10px 12px' }}>Transactions</NavLink>
            <NavLink to="/calculator" style={{ color: 'white', textDecoration: 'none', padding: '10px 12px' }}>Calculator</NavLink>
            <NavLink to="/alerts" style={{ color: 'white', textDecoration: 'none', padding: '10px 12px' }}>Alerts</NavLink>
          </nav>

          <button
            onClick={onLogout}
            style={{
              marginTop: 24,
              width: '100%',
              padding: '10px 12px',
              border: 'none',
              borderRadius: 8,
              background: '#dc2626',
              color: 'white',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Log out
          </button>
        </aside>

        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/reconciliation" element={<ReconciliationPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/calculator" element={<CalculatorPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function Root() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');

  useEffect(() => {
    const current = localStorage.getItem('token') || '';
    setToken(current);
  }, []);

  function handleLogin(newToken) {
    setToken(newToken);
    window.location.reload();
  }

  function handleLogout() {
    localStorage.removeItem('token');
    setToken('');
    window.location.reload();
  }

  if (!token) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <AppShell onLogout={handleLogout} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);

