import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Server, RefreshCw, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { apiClient } from '../utils/api';

/**
 * Parse a UTC datetime string from the backend.
 * Backend uses datetime.utcnow() which omits timezone info.
 * We append 'Z' so the browser knows it's UTC and converts to local time.
 */
const parseUTC = (dateString) => {
  if (!dateString) return null;
  if (dateString.endsWith('Z') || dateString.includes('+') || dateString.includes('-', 10)) {
    return new Date(dateString);
  }
  return new Date(dateString + 'Z');
};

const FleetSync = () => {
  const queryClient = useQueryClient();
  const [expandedLog, setExpandedLog] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: syncLogs, isLoading } = useQuery({
    queryKey: ['fleet-sync-logs'],
    queryFn: () => apiClient.get('/api/fleet/sync-logs'),
    // Poll every 3 seconds while a sync is running
    refetchInterval: isSyncing ? 3000 : false,
  });

  // Detect when polling finds the sync has completed
  React.useEffect(() => {
    if (isSyncing && syncLogs && syncLogs.length > 0) {
      const hasRunning = syncLogs.some(log => log.status === 'running');
      if (!hasRunning) {
        setIsSyncing(false);
        // Refresh related data now that sync is done
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        queryClient.invalidateQueries({ queryKey: ['assets'] });
      }
    }
  }, [syncLogs, isSyncing, queryClient]);

  const { data: schedulerStatus } = useQuery({
    queryKey: ['scheduler-status'],
    queryFn: () => apiClient.get('/api/scheduler/status')
  });

  const syncMutation = useMutation({
    mutationFn: () => apiClient.post('/api/fleet/sync'),
    onSuccess: (data) => {
      toast.success(`Sync completed! ${data.stats.created} created, ${data.stats.updated} updated`);
      queryClient.invalidateQueries({ queryKey: ['fleet-sync-logs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setIsSyncing(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Sync failed');
      queryClient.invalidateQueries({ queryKey: ['fleet-sync-logs'] });
      setIsSyncing(false);
    }
  });

  const handleSync = () => {
    setIsSyncing(true);
    syncMutation.mutate();
    // Refetch logs after a short delay to pick up the new "running" entry
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['fleet-sync-logs'] });
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

  const formatNextRun = () => {
    if (!schedulerStatus?.enabled || !schedulerStatus?.jobs?.length) return null;
    const nextRun = schedulerStatus.jobs[0]?.next_run;
    if (!nextRun) return null;
    const date = new Date(nextRun);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    });
  };

  const nextRunDisplay = formatNextRun();

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Fleet MDM Sync</h1>
        <p className="page-subtitle">Synchronize devices from Fleet MDM</p>
      </div>

      <div className="card mb-3" style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        border: 'none'
      }}>
        <div className="flex items-center justify-between">
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
              Automatic Device Synchronization
            </div>
            <div style={{ opacity: 0.9, fontSize: '14px' }}>
              Automatically pulls device information and user assignments from Fleet MDM
            </div>
            <div style={{ marginTop: '16px', display: 'flex', gap: '24px', fontSize: '14px' }}>
              <div>
                <div style={{ opacity: 0.8 }}>Features</div>
                <div style={{ fontWeight: 600 }}>• Device specs sync</div>
                <div style={{ fontWeight: 600 }}>• Auto-assignment</div>
                <div style={{ fontWeight: 600 }}>• Lock detection</div>
              </div>
              {nextRunDisplay && (
                <div>
                  <div style={{ opacity: 0.8 }}>Next Scheduled Sync</div>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} />
                    {nextRunDisplay}
                  </div>
                </div>
              )}
            </div>
          </div>
          <button 
            onClick={handleSync} 
            disabled={isSyncing}
            className="btn btn-lg"
            style={{
              background: 'white',
              color: '#667eea',
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
          <h2 className="card-title">Recent Sync History</h2>
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
                  <th>Updated</th>
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
                          <span className="badge badge-info" style={{ fontVariantNumeric: 'tabular-nums' }}>
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
                        {log.devices_updated > 0 ? (
                          <span className="badge badge-info">{log.devices_updated}</span>
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
            <Server size={48} color="var(--color-text-tertiary)" />
            <h3 className="empty-state-title">No sync history yet</h3>
            <p className="empty-state-description">
              Click "Sync Now" to perform your first synchronization with Fleet MDM
            </p>
          </div>
        )}
      </div>

      <div className="card mt-3">
        <div className="card-header">
          <h2 className="card-title">How Fleet Sync Works</h2>
        </div>
        <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
          <div style={{ marginBottom: '16px' }}>
            <strong>1. Device Discovery</strong><br/>
            Fetches all enrolled devices from your Fleet MDM instance including hardware specs, OS versions, and device status.
          </div>
          <div style={{ marginBottom: '16px' }}>
            <strong>2. Auto-Assignment</strong><br/>
            Automatically assigns devices to employees based on the user logged into each device in Fleet. Manual assignments can override this behavior.
          </div>
          <div style={{ marginBottom: '16px' }}>
            <strong>3. Lock Detection</strong><br/>
            Detects pin-locked devices and automatically transitions them to Locked status, clearing the previous user assignment.
          </div>
          <div>
            <strong>4. Nightly Sync</strong><br/>
            Runs automatically every night at 9:00 PM Pacific. Manual syncs can be triggered anytime using the Sync Now button above.
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

export default FleetSync;
