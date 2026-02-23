import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { RefreshCw, CheckCircle, XCircle, Clock, Package, ShoppingBag, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { apiClient } from '../utils/api';

const parseUTC = (dateString) => {
  if (!dateString) return null;
  if (dateString.endsWith('Z') || dateString.includes('+') || dateString.includes('-', 10)) {
    return new Date(dateString);
  }
  return new Date(dateString + 'Z');
};

const ABMSync = () => {
  const queryClient = useQueryClient();
  const [expandedLog, setExpandedLog] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: syncLogs, isLoading } = useQuery({
    queryKey: ['abm-sync-logs'],
    queryFn: () => apiClient.get('/api/abm/sync-logs'),
    refetchInterval: isSyncing ? 3000 : false,
  });

  // Detect when polling finds the sync has completed
  React.useEffect(() => {
    if (isSyncing && syncLogs && syncLogs.length > 0) {
      const hasRunning = syncLogs.some(log => log.status === 'running');
      if (!hasRunning) {
        setIsSyncing(false);
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        queryClient.invalidateQueries({ queryKey: ['assets'] });
      }
    }
  }, [syncLogs, isSyncing, queryClient]);

  const syncMutation = useMutation({
    mutationFn: () => apiClient.post('/api/abm/sync'),
    onSuccess: (data) => {
      toast.success(`ABM sync completed! ${data.stats.created} new, ${data.stats.enriched} enriched`);
      queryClient.invalidateQueries({ queryKey: ['abm-sync-logs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setIsSyncing(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'ABM sync failed');
      queryClient.invalidateQueries({ queryKey: ['abm-sync-logs'] });
      setIsSyncing(false);
    }
  });

  const handleSync = () => {
    setIsSyncing(true);
    syncMutation.mutate();
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['abm-sync-logs'] });
    }, 1000);
  };

  const formatDateTime = (dateString) => {
    const date = parseUTC(dateString);
    if (!date) return '-';
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    });
  };

  const formatDuration = (start, end) => {
    const startDate = parseUTC(start);
    const endDate = parseUTC(end);
    if (!startDate || !endDate) return '-';
    const duration = Math.round((endDate - startDate) / 1000);
    if (duration >= 60) {
      const mins = Math.floor(duration / 60);
      const secs = duration % 60;
      return `${mins}m ${secs}s`;
    }
    return `${duration}s`;
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Apple Business Manager Sync</h1>
        <p className="page-subtitle">Synchronize device data from Apple Business Manager</p>
      </div>

      <div className="card mb-3" style={{
        background: 'linear-gradient(135deg, #1d1d1f 0%, #424245 100%)',
        color: 'white',
        border: 'none'
      }}>
        <div className="flex items-center justify-between">
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
              Apple Business Manager Integration
            </div>
            <div style={{ opacity: 0.9, fontSize: '14px' }}>
              Pulls device purchase data, enrollment status, and hardware details from ABM
            </div>
            <div style={{ marginTop: '16px', display: 'flex', gap: '32px', fontSize: '14px' }}>
              <div>
                <div style={{ opacity: 0.7, marginBottom: '4px' }}>What syncs</div>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <ShoppingBag size={14} /> Order & purchase info
                </div>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <Package size={14} /> Model, color, capacity
                </div>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Shield size={14} /> ABM enrollment status
                </div>
              </div>
              <div>
                <div style={{ opacity: 0.7, marginBottom: '4px' }}>How it works</div>
                <div style={{ fontSize: '13px', opacity: 0.9, maxWidth: '300px' }}>
                  Matches ABM devices to existing inventory by serial number.
                  Creates new records for devices not yet tracked.
                </div>
              </div>
            </div>
          </div>
          <button 
            onClick={handleSync} 
            disabled={isSyncing}
            className="btn btn-lg"
            style={{
              background: 'white',
              color: '#1d1d1f',
              fontWeight: 700
            }}
          >
            <RefreshCw size={20} className={isSyncing ? 'spin' : ''} />
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Recent ABM Sync History</h2>
        </div>
        {isLoading ? (
          <div className="loading">Loading sync history...</div>
        ) : syncLogs && syncLogs.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Processed</th>
                  <th>Created</th>
                  <th>Enriched</th>
                  <th>Errors</th>
                </tr>
              </thead>
              <tbody>
                {syncLogs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr>
                      <td>
                        {log.status === 'completed' ? (
                          <span className="badge badge-success">
                            <CheckCircle size={12} />
                            Completed
                          </span>
                        ) : log.status === 'failed' ? (
                          <span className="badge badge-danger">
                            <XCircle size={12} />
                            Failed
                          </span>
                        ) : (
                          <span className="badge badge-info">
                            <Clock size={12} />
                            Running
                          </span>
                        )}
                      </td>
                      <td className="text-sm">{formatDateTime(log.sync_started)}</td>
                      <td className="text-sm">
                        {log.status === 'running' ? (
                          <span className="badge badge-info">
                            <RefreshCw size={12} className="spin" /> In progress…
                          </span>
                        ) : (
                          formatDuration(log.sync_started, log.sync_completed)
                        )}
                      </td>
                      <td>{log.devices_processed}</td>
                      <td>
                        {log.devices_created > 0 ? (
                          <span className="badge badge-success">{log.devices_created}</span>
                        ) : (
                          <span className="text-muted">0</span>
                        )}
                      </td>
                      <td>
                        {log.devices_enriched > 0 ? (
                          <span className="badge badge-info">{log.devices_enriched}</span>
                        ) : (
                          <span className="text-muted">0</span>
                        )}
                      </td>
                      <td>
                        {log.errors ? (
                          <button
                            onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                            className="badge badge-danger"
                            style={{ cursor: 'pointer', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            {expandedLog === log.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {expandedLog === log.id ? 'Hide' : 'View'}
                          </button>
                        ) : (
                          <span className="text-muted">None</span>
                        )}
                      </td>
                    </tr>
                    {expandedLog === log.id && log.errors && (
                      <tr>
                        <td colSpan={7} style={{ padding: 0 }}>
                          <div style={{
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            margin: '0 16px 16px 16px',
                            padding: '12px 16px',
                            fontSize: '13px',
                            fontFamily: 'monospace',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            maxHeight: '300px',
                            overflowY: 'auto',
                            color: '#991b1b'
                          }}>
                            {log.errors}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Package size={48} color="var(--color-text-tertiary)" />
            <h3 className="empty-state-title">No ABM sync history yet</h3>
            <p className="empty-state-description">
              Click "Sync Now" to pull device data from Apple Business Manager
            </p>
          </div>
        )}
      </div>

      <div className="card mt-3">
        <div className="card-header">
          <h2 className="card-title">ABM + Fleet: How They Work Together</h2>
        </div>
        <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
          <div style={{ marginBottom: '16px' }}>
            <strong>Apple Business Manager</strong> provides purchase and enrollment data — order numbers,
            device models, colors, capacity, and when devices were added to your organization.
            This is your source of truth for <em>what you own</em>.
          </div>
          <div style={{ marginBottom: '16px' }}>
            <strong>Fleet MDM</strong> provides operational data — OS versions, logged-in users,
            hardware specs, and last-seen timestamps.
            This is your source of truth for <em>who's using what</em>.
          </div>
          <div>
            Both sync sources match devices by <strong>serial number</strong>, so running both
            gives you a complete picture: purchase history from ABM and live status from Fleet,
            all in one place.
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .spin {
            animation: spin 1s linear infinite;
          }
        `}
      </style>
    </div>
  );
};

export default ABMSync;
