import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Package, CheckCircle, AlertCircle, Lock, TrendingUp, Server } from 'lucide-react';
import { apiClient } from '../utils/api';

// Platform icon components
const AppleIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 384 512" fill="#1d1d1f">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
  </svg>
);

const WindowsIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 448 512" fill="#0078d4">
    <path d="M0 93.7l183.6-25.3v177.4H0V93.7zm0 324.6l183.6 25.3V268.4H0v149.9zm203.8 28L448 480V268.4H203.8v177.9zm0-380.6v180.1H448V32L203.8 65.7z"/>
  </svg>
);

const IPhoneIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 320 512" fill="#1d1d1f">
    <path d="M272 0H48C21.5 0 0 21.5 0 48v416c0 26.5 21.5 48 48 48h224c26.5 0 48-21.5 48-48V48c0-26.5-21.5-48-48-48zM160 480c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32z"/>
  </svg>
);

const IPadIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 448 512" fill="#1d1d1f">
    <path d="M400 0H48C21.5 0 0 21.5 0 48v416c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48V48c0-26.5-21.5-48-48-48zM224 480c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32z"/>
  </svg>
);

const TvIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 640 512" fill="#1d1d1f">
    <path d="M592 0H48C21.5 0 0 21.5 0 48v320c0 26.5 21.5 48 48 48h245.1v32h-160c-17.7 0-32 14.3-32 32s14.3 32 32 32h384c17.7 0 32-14.3 32-32s-14.3-32-32-32h-160v-32H592c26.5 0 48-21.5 48-48V48c0-26.5-21.5-48-48-48z"/>
  </svg>
);

const platformIcons = {
  'macOS': AppleIcon,
  'Windows': WindowsIcon,
  'iOS': IPhoneIcon,
  'iPadOS': IPadIcon,
  'tvOS': TvIcon,
};

const Dashboard = () => {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiClient.get('/api/dashboard/stats')
  });

  if (isLoading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  const statCards = [
    { label: 'Total Assets', value: stats?.total_assets || 0, icon: Package, color: '#2563eb', link: '/assets' },
    { label: 'Assigned', value: stats?.assigned || 0, icon: CheckCircle, color: '#10b981', link: '/assets?status=assigned' },
    { label: 'Available', value: stats?.available || 0, icon: TrendingUp, color: '#f59e0b', link: '/assets?status=available' },
    { label: 'Locked', value: stats?.locked || 0, icon: Lock, color: '#ef4444', link: '/assets?status=locked' },
    { label: 'Warranty Expiring', value: stats?.warranty_expiring_soon || 0, icon: AlertCircle, color: '#f59e0b', link: '/assets?warranty=expiring' },
    { label: 'Fleet Enrolled', value: stats?.fleet_enrolled || 0, icon: Server, color: '#8b5cf6', link: '/assets?fleet=enrolled' }
  ];

  const platformBreakdown = stats?.platform_breakdown || {};
  const totalForPercentage = Object.values(platformBreakdown).reduce((a, b) => a + b, 0) || 1;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Hardware Asset Management Overview</p>
      </div>

      <div className="stat-grid">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="stat-card stat-card-clickable" onClick={() => navigate(stat.link)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(stat.link)}>
              <div className="flex items-center justify-between mb-2">
                <div className="stat-label">{stat.label}</div>
                <Icon size={24} color={stat.color} />
              </div>
              <div className="stat-value">{stat.value}</div>
            </div>
          );
        })}
      </div>

      <div className="card mt-4">
        <div className="card-header">
          <h2 className="card-title">Platform Breakdown</h2>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Platform</th>
                <th>Count</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(platformBreakdown).map(([platform, count]) => {
                const PlatformIcon = platformIcons[platform];
                return (
                  <tr key={platform} style={{ cursor: 'pointer' }} onClick={() => navigate(`/assets?platform=${encodeURIComponent(platform)}`)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {PlatformIcon ? <PlatformIcon size={18} /> : <Package size={18} color="#9ca3af" />}
                        <span style={{ fontWeight: 500 }}>{platform}</span>
                      </div>
                    </td>
                    <td>{count}</td>
                    <td>{((count / totalForPercentage) * 100).toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <style>
        {`
          .stat-card-clickable { cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease; }
          .stat-card-clickable:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12); }
          .stat-card-clickable:active { transform: translateY(-1px); }
        `}
      </style>
    </div>
  );
};

export default Dashboard;
