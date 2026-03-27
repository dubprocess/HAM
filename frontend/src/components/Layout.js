import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useOktaAuth } from '@okta/okta-react';
import { LayoutDashboard, Package, Server, Smartphone, LogOut, User } from 'lucide-react';

const Layout = () => {
  const { oktaAuth, authState } = useOktaAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await oktaAuth.signOut();
    navigate('/login');
  };

  if (!authState || !authState.isAuthenticated) {
    return <div className="loading">Loading...</div>;
  }

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/assets', label: 'Assets', icon: Package },
    { path: '/fleet-sync', label: 'Fleet Sync', icon: Server },
    { path: '/abm-sync', label: 'ABM Sync', icon: Smartphone }
  ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src="/ham-sidebar.svg" alt="HAM" style={{ width: 130 }} />
        </div>
        
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                end={item.path === '/'}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '24px', borderTop: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2 mb-3">
            <User size={20} color="var(--color-text-secondary)" />
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {authState.idToken?.claims.name || 'User'}
              </div>
              <div className="text-sm text-muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {authState.idToken?.claims.email}
              </div>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%' }}>
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
