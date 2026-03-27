import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { LogIn, Lock, Mail, Eye, EyeOff } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const LOCAL_AUTH = process.env.REACT_APP_LOCAL_AUTH === 'true';

// ── Local auth login form ────────────────────────────────────────────────────

const LocalLogin = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Login failed');
      }
      const data = await res.json();
      localStorage.setItem('ham-local-token', data.access_token);
      localStorage.setItem('ham-local-user', JSON.stringify(data.user));
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600, color: '#374151' }}>Email</label>
        <div style={{ position: 'relative' }}>
          <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="admin@example.com"
            style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600, color: '#374151' }}>Password</label>
        <div style={{ position: 'relative' }}>
          <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            style={{ width: '100%', padding: '10px 36px 10px 36px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#dc2626', fontSize: 14 }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center' }}
      >
        <LogIn size={18} />
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
};


// ── Okta login button ────────────────────────────────────────────────────────

const OktaLogin = () => {
  const handleLogin = async () => {
    // Dynamic import so Okta SDK is only loaded when needed
    const { OktaAuth } = await import('@okta/okta-auth-js');
    const oktaAuth = new OktaAuth({
      issuer: process.env.REACT_APP_OKTA_ISSUER || process.env.REACT_APP_OIDC_ISSUER,
      clientId: process.env.REACT_APP_OKTA_CLIENT_ID || process.env.REACT_APP_OIDC_CLIENT_ID,
      redirectUri: window.location.origin + '/login/callback',
      scopes: ['openid', 'profile', 'email'],
    });
    await oktaAuth.signInWithRedirect();
  };

  return (
    <>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 32, textAlign: 'center' }}>
        Sign in with your OIDC provider to continue
      </p>
      <button onClick={handleLogin} className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}>
        <LogIn size={20} />
        Sign in with Okta
      </button>
    </>
  );
};


// ── Main Login component ─────────────────────────────────────────────────────

const Login = () => {
  const [authMode, setAuthMode] = useState(LOCAL_AUTH ? 'local' : 'oidc');
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if already logged in
    if (authMode === 'local') {
      const token = localStorage.getItem('ham-local-token');
      if (token) setAuthed(true);
      setChecking(false);
    } else {
      // For OIDC, check /api/auth/mode to confirm server mode
      fetch(`${API_URL}/api/auth/mode`)
        .then(r => r.json())
        .then(data => {
          if (data.local_auth) setAuthMode('local');
        })
        .catch(() => {})
        .finally(() => setChecking(false));
    }
  }, [authMode]);

  if (checking) return <div className="loading">Loading...</div>;
  if (authed) return <Navigate to="/" replace />;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div style={{
        background: 'white',
        borderRadius: 16,
        padding: 48,
        maxWidth: 420,
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <img
          src="/ham-logo.svg"
          alt="HAM - Hardware Asset Management"
          style={{ width: 160, margin: '0 auto 32px', display: 'block' }}
        />

        {authMode === 'local' ? (
          <>
            <h2 style={{ textAlign: 'center', marginBottom: 24, fontSize: 20, fontWeight: 700, color: '#111827' }}>
              Sign in to HAM
            </h2>
            <LocalLogin onSuccess={() => setAuthed(true)} />
            <p style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
              Local auth mode — no external IdP required
            </p>
          </>
        ) : (
          <OktaLogin />
        )}
      </div>
    </div>
  );
};

export default Login;
