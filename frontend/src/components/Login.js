import React from 'react';
import { useOktaAuth } from '@okta/okta-react';
import { Navigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';

const Login = () => {
  const { oktaAuth, authState } = useOktaAuth();

  if (!authState) {
    return <div className="loading">Loading...</div>;
  }

  if (authState.isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async () => {
    await oktaAuth.signInWithRedirect();
  };

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
        borderRadius: '16px',
        padding: '48px',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        textAlign: 'center'
      }}>
        <img 
          src="/ham-logo.svg" 
          alt="HAM - Hardware Asset Management" 
          style={{ width: 180, margin: '0 auto 32px', display: 'block' }} 
        />
        
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '32px' }}>
          Sign in with your Okta account to continue
        </p>
        
        <button onClick={handleLogin} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
          <LogIn size={20} />
          Sign in with Okta
        </button>
      </div>
    </div>
  );
};

export default Login;
