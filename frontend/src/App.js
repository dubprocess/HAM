import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Security, LoginCallback, SecureRoute } from '@okta/okta-react';
import { OktaAuth, toRelativeUrl } from '@okta/okta-auth-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import Dashboard from './components/Dashboard';
import AssetList from './components/AssetList';
import AssetDetail from './components/AssetDetail';
import AssetCreate from './components/AssetCreate';
import FleetSync from './components/FleetSync';
import ABMSync from './components/ABMSync';
import Login from './components/Login';
import Layout from './components/Layout';

import './App.css';

const queryClient = new QueryClient();

const oktaAuth = new OktaAuth({
  issuer: process.env.REACT_APP_OKTA_ISSUER,
  clientId: process.env.REACT_APP_OKTA_CLIENT_ID,
  redirectUri: window.location.origin + '/login/callback',
  scopes: ['openid', 'profile', 'email']
});

function App() {
  const restoreOriginalUri = async (_oktaAuth, originalUri) => {
    window.location.replace(
      toRelativeUrl(originalUri || '/', window.location.origin)
    );
  };

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Security oktaAuth={oktaAuth} restoreOriginalUri={restoreOriginalUri}>
          <div className="App">
            <Toaster position="top-right" />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/login/callback" element={<LoginCallback />} />
              
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/assets" element={<AssetList />} />
                <Route path="/assets/new" element={<AssetCreate />} />
                <Route path="/assets/:id" element={<AssetDetail />} />
                <Route path="/fleet-sync" element={<FleetSync />} />
                <Route path="/abm-sync" element={<ABMSync />} />
              </Route>
            </Routes>
          </div>
        </Security>
      </Router>
    </QueryClientProvider>
  );
}

export default App;