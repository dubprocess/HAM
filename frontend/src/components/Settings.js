import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Bell, Send, CheckCircle, XCircle, Loader, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';

const Settings = () => {
  const [settings, setSettings] = useState({
    warranty_expiry_days: 30,
    unassigned_days: 60,
    locked_days: 60,
    slack_configured: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingAll, setTestingAll] = useState(false);
  const [testingType, setTestingType] = useState(null);
  const [thresholdsOpen, setThresholdsOpen] = useState(false);
  const [testAlertsOpen, setTestAlertsOpen] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/api/settings/alerts`);
      if (response.ok) setSettings(await response.json());
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/settings/alerts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warranty_expiry_days: settings.warranty_expiry_days,
          unassigned_days: settings.unassigned_days,
          locked_days: settings.locked_days,
        }),
      });
      if (response.ok) toast.success('Settings saved');
      else toast.error('Failed to save settings');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const testAllAlerts = async () => {
    setTestingAll(true);
    try {
      const response = await fetch(`${API_URL}/api/alerts/test/all`, { method: 'POST' });
      if (response.ok) toast.success('All test alerts sent to Slack');
      else {
        const data = await response.json();
        toast.error(data.detail || 'Failed to send test alerts');
      }
    } catch (error) {
      toast.error('Failed to send test alerts');
    } finally {
      setTestingAll(false);
    }
  };

  const testSingleAlert = async (type) => {
    setTestingType(type);
    try {
      const response = await fetch(`${API_URL}/api/alerts/test/${type}`, { method: 'POST' });
      if (response.ok) toast.success(`Test alert sent: ${type}`);
      else {
        const data = await response.json();
        toast.error(data.detail || `Failed to send ${type} alert`);
      }
    } catch (error) {
      toast.error(`Failed to send ${type} alert`);
    } finally {
      setTestingType(null);
    }
  };

  const updateSetting = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  const alertTypes = [
    { id: 'sync-failure', label: 'Sync Failure', description: 'Fleet or ABM sync error' },
    { id: 'warranty-expiring', label: 'Warranty Expiring', description: 'Within threshold days' },
    { id: 'assignment-failure', label: 'Assignment Failure', description: 'Could not auto-assign' },
    { id: 'manual-assignment', label: 'Manual Assignment', description: 'Device manually assigned via GUI' },
    { id: 'manual-location-change', label: 'Manual Location Change', description: 'Device location changed via GUI' },
    { id: 'unassigned-too-long', label: 'Unassigned Too Long', description: 'Beyond threshold' },
    { id: 'locked-too-long', label: 'Locked Too Long', description: 'Beyond threshold' },
    { id: 'abm-removed', label: 'ABM Device Removed', description: 'Device removed from Apple Business Manager' },
  ];

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
          <Loader size={24} className="spin" /> <span style={{ marginLeft: 8 }}>Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1><SettingsIcon size={28} style={{ marginRight: 8, verticalAlign: 'middle' }} /> Settings</h1>
      </div>

      {/* Slack Status */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h2><Bell size={20} style={{ marginRight: 8 }} /> Slack Alerts</h2>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            {settings.slack_configured
              ? <><CheckCircle size={18} color="#28a745" /> <span>Slack webhook connected</span></>
              : <><XCircle size={18} color="#dc3545" /> <span>Slack webhook not configured &mdash; set SLACK_WEBHOOK_URL in .env</span></>
            }
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 16 }}>
            Alerts are sent to your configured Slack channel.
            See <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noreferrer">Slack webhook docs</a> to set up.
          </p>
        </div>
      </div>

      {/* Alert Thresholds */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div
          className="card-header"
          onClick={() => setThresholdsOpen(!thresholdsOpen)}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
        >
          <h2 style={{ display: 'flex', alignItems: 'center', margin: 0 }}>Alert Thresholds</h2>
          {thresholdsOpen ? <ChevronDown size={20} color="var(--color-text-secondary)" /> : <ChevronRight size={20} color="var(--color-text-secondary)" />}
        </div>
        {thresholdsOpen && (
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label className="form-label">Warranty expiring alert (days before expiry)</label>
                <input type="number" className="form-input" value={settings.warranty_expiry_days}
                  onChange={(e) => updateSetting('warranty_expiry_days', parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label className="form-label">Device unassigned too long (days)</label>
                <input type="number" className="form-input" value={settings.unassigned_days}
                  onChange={(e) => updateSetting('unassigned_days', parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label className="form-label">Device locked too long (days)</label>
                <input type="number" className="form-input" value={settings.locked_days}
                  onChange={(e) => updateSetting('locked_days', parseInt(e.target.value) || 0)} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 24 }}>
        <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>
          {saving ? <><Loader size={16} className="spin" /> Saving...</> : 'Save Settings'}
        </button>
      </div>

      {/* Test Alerts */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div
          className="card-header"
          onClick={() => setTestAlertsOpen(!testAlertsOpen)}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
        >
          <h2 style={{ display: 'flex', alignItems: 'center', margin: 0 }}>
            <Send size={20} style={{ marginRight: 8 }} /> Test Alerts
          </h2>
          {testAlertsOpen ? <ChevronDown size={20} color="var(--color-text-secondary)" /> : <ChevronRight size={20} color="var(--color-text-secondary)" />}
        </div>
        {testAlertsOpen && (
          <div className="card-body">
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 16 }}>
              Send test alerts to Slack with sample data. Each alert will be tagged with [TEST].
            </p>
            <div style={{ marginBottom: 16 }}>
              <button className="btn btn-primary" onClick={testAllAlerts} disabled={testingAll || !settings.slack_configured}>
                {testingAll ? <><Loader size={16} className="spin" /> Sending...</> : 'Send All Test Alerts'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {alertTypes.map((alert) => (
                <div key={alert.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderRadius: 8,
                  border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)'
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{alert.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{alert.description}</div>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => testSingleAlert(alert.id)}
                    disabled={testingType === alert.id || !settings.slack_configured}
                    style={{ minWidth: 60 }}
                  >
                    {testingType === alert.id ? <Loader size={14} className="spin" /> : 'Test'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
