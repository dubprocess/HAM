import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Edit2, UserPlus, UserMinus, Wrench, Trash2, Server, Shield, ShieldCheck, ShieldAlert, ShieldX, Lock, ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import AppleLogo from './AppleLogo';
import { apiClient } from '../utils/api';

// Dedicated red Apple logo for AppleCare
const AppleCareIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path fill="#E03A3E" d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
);

const LOCATION_OPTIONS = [
  { value: '', label: 'No Location' },
  { value: 'NYC', label: 'NYC — New York' },
  { value: 'SFO', label: 'SFO — San Francisco' },
  { value: 'ORD', label: 'ORD — Chicago' },
  { value: 'BEL', label: 'BEL — Belgrade' },
  { value: 'Remote', label: 'Remote' },
];

const AssetDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [assignForm, setAssignForm] = useState({
    assigned_email: '',
    assigned_to: '',
    assigned_username: '',
    department: '',
    location: '',
    assignment_override: false
  });

  const { data: asset, isLoading } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => apiClient.get(`/api/assets/${id}`)
  });

  const { data: maintenance } = useQuery({
    queryKey: ['maintenance', id],
    queryFn: () => apiClient.get(`/api/assets/${id}/maintenance`)
  });

  const { data: auditLog } = useQuery({
    queryKey: ['audit', id],
    queryFn: () => apiClient.get(`/api/assets/${id}/audit`)
  });

  const assignMutation = useMutation({
    mutationFn: (data) => apiClient.post(`/api/assets/${id}/assign`, data),
    onSuccess: () => {
      toast.success('Asset assigned successfully!');
      setShowAssignModal(false);
      queryClient.invalidateQueries(['asset', id]);
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.detail;
      if (Array.isArray(errorMsg)) {
        toast.error(errorMsg[0]?.msg || 'Failed to assign asset');
      } else if (typeof errorMsg === 'string') {
        toast.error(errorMsg);
      } else {
        toast.error('Failed to assign asset');
      }
    }
  });

  const returnMutation = useMutation({
    mutationFn: () => apiClient.post(`/api/assets/${id}/return`),
    onSuccess: () => {
      toast.success('Asset returned successfully!');
      queryClient.invalidateQueries(['asset', id]);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.delete(`/api/assets/${id}`),
    onSuccess: () => {
      toast.success('Asset retired successfully!');
      navigate('/assets');
    }
  });

  const updateLocationMutation = useMutation({
    mutationFn: (location) => apiClient.put(`/api/assets/${id}`, { location }),
    onSuccess: () => {
      toast.success('Location updated');
      queryClient.invalidateQueries(['asset', id]);
      queryClient.invalidateQueries(['audit', id]);
    },
    onError: () => {
      toast.error('Failed to update location');
    }
  });

  if (isLoading) {
    return <div className="loading">Loading asset...</div>;
  }

  const handleAssign = () => {
    assignMutation.mutate({ assignment: assignForm });
  };

  const handleLocationChange = (newLocation) => {
    updateLocationMutation.mutate(newLocation);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  const isAssigned = asset.assigned_to || asset.assigned_email;
  const displayName = asset.assigned_to || (asset.assigned_email ? asset.assigned_email.split('@')[0] : '');
  const hasABMData = asset.abm_device_id || asset.abm_order_number || asset.abm_status;
  const hasAppleCareData = asset.applecare_status || asset.applecare_description;
  const purchaseDate = asset.purchase_date || asset.abm_order_date;
  const supplier = asset.supplier || (asset.abm_purchase_source ? asset.abm_purchase_source.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : null);

  const getWarrantyStatus = () => {
    if (!asset.warranty_expiration) return null;
    const expDate = new Date(asset.warranty_expiration);
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    if (expDate < now) return 'expired';
    if (expDate < thirtyDays) return 'expiring';
    return 'active';
  };

  const warrantyStatus = getWarrantyStatus();

  const getWarrantyBadge = () => {
    if (!warrantyStatus) return null;
    const config = {
      active: { class: 'badge-success', label: 'Covered', Icon: ShieldCheck },
      expiring: { class: 'badge-warning', label: 'Expiring Soon', Icon: ShieldAlert },
      expired: { class: 'badge-danger', label: 'Expired', Icon: ShieldX },
    };
    const c = config[warrantyStatus];
    return (
      <span className={`badge ${c.class}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <c.Icon size={12} />
        {c.label}
      </span>
    );
  };

  const getAppleCareBadge = () => {
    if (!asset.applecare_status) return null;
    if (asset.applecare_status === 'ACTIVE') {
      return (
        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <ShieldCheck size={12} />
          Active
        </span>
      );
    }
    return (
      <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <ShieldX size={12} />
        Inactive
      </span>
    );
  };

  const getStatusBadgeClass = () => {
    if (asset.status === 'available') return 'badge-success';
    if (asset.status === 'assigned') return 'badge-info';
    if (asset.status === 'locked') return 'badge-danger';
    return 'badge-secondary';
  };

  return (
    <div>
      <div className="page-header">
        <button onClick={() => navigate(-1)} className="btn btn-secondary btn-sm mb-2">
          <ArrowLeft size={16} />
          Back to Assets
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">{asset.asset_tag}</h1>
            <p className="page-subtitle">{asset.manufacturer} {asset.model}</p>
          </div>
          <div className="flex gap-2">
            {isAssigned ? (
              <button onClick={() => returnMutation.mutate()} className="btn btn-secondary">
                <UserMinus size={18} />
                Return Asset
              </button>
            ) : (
              <button onClick={() => setShowAssignModal(true)} className="btn btn-primary">
                <UserPlus size={18} />
                Assign Asset
              </button>
            )}
            <button onClick={() => deleteMutation.mutate()} className="btn btn-danger">
              <Trash2 size={18} />
              Retire
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <div>
          {/* Device Information */}
          <div className="card mb-3">
            <div className="card-header">
              <h2 className="card-title">Device Information</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div className="text-sm text-muted">Serial Number</div>
                <div className="mono">{asset.serial_number}</div>
              </div>
              <div>
                <div className="text-sm text-muted">Device Type</div>
                <div style={{ textTransform: 'capitalize' }}>{asset.device_type}</div>
              </div>
              <div>
                <div className="text-sm text-muted">Hostname</div>
                <div>{asset.hostname || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-muted">Operating System</div>
                <div>{asset.os_type} {asset.os_version}</div>
              </div>
              <div>
                <div className="text-sm text-muted">Processor</div>
                <div>{asset.processor || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-muted">RAM</div>
                <div>{asset.ram_gb ? `${asset.ram_gb} GB` : '-'}</div>
              </div>
              <div>
                <div className="text-sm text-muted">Storage</div>
                <div>{asset.storage_gb ? `${asset.storage_gb} GB` : '-'}</div>
              </div>
            </div>
          </div>

          {/* Apple Business Manager */}
          {hasABMData && (
            <div className="card mb-3">
              <div className="card-header">
                <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AppleLogo size={18} />
                  Apple Business Manager
                </h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {asset.abm_status && (
                  <div>
                    <div className="text-sm text-muted">ABM Status</div>
                    <span className={`badge ${asset.abm_status === 'ASSIGNED' ? 'badge-info' : 'badge-secondary'}`}>
                      {asset.abm_status}
                    </span>
                  </div>
                )}
                {asset.abm_product_family && (
                  <div>
                    <div className="text-sm text-muted">Product Family</div>
                    <div>{asset.abm_product_family}</div>
                  </div>
                )}
                {asset.abm_color && (
                  <div>
                    <div className="text-sm text-muted">Color</div>
                    <div>{asset.abm_color}</div>
                  </div>
                )}
                {asset.abm_device_capacity && (
                  <div>
                    <div className="text-sm text-muted">Capacity</div>
                    <div>{asset.abm_device_capacity}</div>
                  </div>
                )}
                {asset.abm_order_number && (
                  <div>
                    <div className="text-sm text-muted">Order Number</div>
                    <div className="mono">{asset.abm_order_number}</div>
                  </div>
                )}
                {asset.abm_part_number && (
                  <div>
                    <div className="text-sm text-muted">Part Number</div>
                    <div className="mono">{asset.abm_part_number}</div>
                  </div>
                )}
                {asset.abm_added_date && (
                  <div>
                    <div className="text-sm text-muted">Added to ABM</div>
                    <div>{formatDate(asset.abm_added_date)}</div>
                  </div>
                )}
                {asset.abm_last_synced && (
                  <div>
                    <div className="text-sm text-muted">Last ABM Sync</div>
                    <div className="text-sm">{formatDateTime(asset.abm_last_synced)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AppleCare Coverage */}
          {hasAppleCareData && (
            <div className="card mb-3" style={{ border: warrantyStatus === 'expiring' ? '1px solid #f59e0b' : warrantyStatus === 'expired' ? '1px solid #ef4444' : undefined }}>
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AppleCareIcon size={18} />
                  AppleCare Coverage
                </h2>
                {getAppleCareBadge()}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {asset.applecare_description && (
                  <div>
                    <div className="text-sm text-muted">Coverage Type</div>
                    <div style={{ fontWeight: 600 }}>{asset.applecare_description}</div>
                  </div>
                )}
                {asset.applecare_agreement_number && (
                  <div>
                    <div className="text-sm text-muted">Agreement Number</div>
                    <div className="mono">{asset.applecare_agreement_number}</div>
                  </div>
                )}
                {asset.applecare_start_date && (
                  <div>
                    <div className="text-sm text-muted">Coverage Start</div>
                    <div>{formatDate(asset.applecare_start_date)}</div>
                  </div>
                )}
                {asset.applecare_end_date && (
                  <div>
                    <div className="text-sm text-muted">Coverage End</div>
                    <div style={{ fontWeight: 600 }}>{formatDate(asset.applecare_end_date)}</div>
                  </div>
                )}
                {asset.applecare_is_renewable !== null && asset.applecare_is_renewable !== undefined && (
                  <div>
                    <div className="text-sm text-muted">Renewable</div>
                    <div>{asset.applecare_is_renewable ? 'Yes' : 'No'}</div>
                  </div>
                )}
                {asset.applecare_payment_type && asset.applecare_payment_type !== 'NONE' && (
                  <div>
                    <div className="text-sm text-muted">Payment Type</div>
                    <div style={{ textTransform: 'capitalize' }}>{asset.applecare_payment_type.toLowerCase()}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Purchase & Warranty */}
          <div className="card mb-3">
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 className="card-title">Purchase & Warranty</h2>
              {getWarrantyBadge()}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div className="text-sm text-muted">Purchase Date</div>
                <div>{formatDate(purchaseDate)}</div>
              </div>
              <div>
                <div className="text-sm text-muted">Purchase Cost</div>
                <div>{asset.purchase_cost ? `$${asset.purchase_cost.toFixed(2)}` : '-'}</div>
              </div>
              <div>
                <div className="text-sm text-muted">Supplier</div>
                <div>{supplier || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-muted">Warranty Expiration</div>
                <div style={{
                  fontWeight: warrantyStatus === 'expiring' || warrantyStatus === 'expired' ? 700 : 400,
                  color: warrantyStatus === 'expired' ? '#ef4444' : warrantyStatus === 'expiring' ? '#f59e0b' : 'inherit'
                }}>
                  {formatDate(asset.warranty_expiration)}
                </div>
              </div>
            </div>
          </div>

          {/* Maintenance History */}
          <div className="card mb-3">
            <div className="card-header flex items-center justify-between">
              <h2 className="card-title">Maintenance History</h2>
              <button className="btn btn-sm btn-secondary">
                <Wrench size={14} />
                Add Record
              </button>
            </div>
            {maintenance && maintenance.length > 0 ? (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Title</th>
                      <th>Date</th>
                      <th>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maintenance.map((record) => (
                      <tr key={record.id}>
                        <td style={{ textTransform: 'capitalize' }}>{record.maintenance_type}</td>
                        <td>{record.title}</td>
                        <td>{formatDate(record.start_date)}</td>
                        <td>{record.cost ? `$${record.cost.toFixed(2)}` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-muted text-sm">No maintenance records</div>
            )}
          </div>

          {/* Audit Log */}
          <div className="card">
            <div
              className="card-header"
              onClick={() => setShowAuditLog(!showAuditLog)}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
            >
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {showAuditLog ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                Audit Log
              </h2>
              <span className="text-sm text-muted">
                {auditLog?.length || 0} {auditLog?.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>
            {showAuditLog && (
              auditLog && auditLog.length > 0 ? (
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {auditLog.map((log) => (
                    <div key={log.id} style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{log.action.replace('_', ' ')}</span>
                        <span className="text-sm text-muted">{formatDateTime(log.timestamp)}</span>
                      </div>
                      <div className="text-sm text-muted">{log.user_name || log.user_email}</div>
                      {log.new_value && (
                        <div className="text-sm mt-1">{log.new_value}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted text-sm" style={{ padding: '12px' }}>No audit logs</div>
              )
            )}
          </div>
        </div>

        <div>
          {/* Status Card */}
          <div className="card mb-3">
            <div className="card-header">
              <h2 className="card-title">Status</h2>
            </div>
            <div>
              <div className="text-sm text-muted mb-2">Current Status</div>
              <span className={`badge ${getStatusBadgeClass()}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                {asset.status === 'locked' && <Lock size={12} />}
                {asset.status}
              </span>
              {asset.fleet_enrolled && (
                <div className="mt-3">
                  <div className="text-sm text-muted mb-2">Fleet MDM</div>
                  <span className="badge badge-info">
                    <Server size={12} />
                    Enrolled
                  </span>
                  <div className="text-sm text-muted mt-2">
                    Last seen: {formatDateTime(asset.fleet_last_seen)}
                  </div>
                </div>
              )}
              {hasABMData && (
                <div className="mt-3">
                  <div className="text-sm text-muted mb-2">Apple Business Manager</div>
                  <span className="badge" style={{ background: '#1d1d1f', color: 'white' }}>
                    <AppleLogo size={12} color="white" />
                    Registered
                  </span>
                </div>
              )}
              {warrantyStatus && (
                <div className="mt-3">
                  <div className="text-sm text-muted mb-2">Warranty</div>
                  {getWarrantyBadge()}
                  {asset.warranty_expiration && (
                    <div className="text-sm text-muted mt-2">
                      Expires: {formatDate(asset.warranty_expiration)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Location Card */}
          <div className="card mb-3">
            <div className="card-header">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={18} />
                Location
              </h2>
            </div>
            <div>
              <select
                className="form-select"
                value={asset.location || ''}
                onChange={(e) => handleLocationChange(e.target.value)}
                style={{ width: '100%' }}
              >
                {LOCATION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <div className="text-sm text-muted" style={{ marginTop: '8px' }}>
                {asset.assigned_email
                  ? 'Auto-set from Okta during sync. Change to override.'
                  : 'Set where this device is physically stored.'}
              </div>
            </div>
          </div>

          {/* Assignment Card */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Assignment</h2>
            </div>
            {isAssigned ? (
              <div>
                <div className="mb-3">
                  <div className="text-sm text-muted">Assigned To</div>
                  <div style={{ fontWeight: 600 }}>{displayName}</div>
                  {asset.assigned_email && (
                    <div className="text-sm text-muted">{asset.assigned_email}</div>
                  )}
                </div>
                {asset.department && (
                  <div className="mb-3">
                    <div className="text-sm text-muted">Department</div>
                    <div>{asset.department}</div>
                  </div>
                )}
                <div>
                  <div className="text-sm text-muted">Assigned On</div>
                  <div>{formatDate(asset.assignment_date)}</div>
                </div>
                {asset.assignment_override && (
                  <div className="mt-3">
                    <span className="badge badge-warning">Manual Assignment</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-muted text-sm">Not currently assigned</div>
            )}
          </div>
        </div>
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ width: '500px', maxWidth: '90%' }}>
            <div className="card-header">
              <h2 className="card-title">Assign Asset</h2>
            </div>
            <div className="form-group">
              <label className="form-label">Employee Email *</label>
              <input
                type="email"
                className="form-input"
                value={assignForm.assigned_email}
                onChange={(e) => setAssignForm({...assignForm, assigned_email: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Employee Name *</label>
              <input
                type="text"
                className="form-input"
                value={assignForm.assigned_to}
                onChange={(e) => setAssignForm({...assignForm, assigned_to: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                type="text"
                className="form-input"
                value={assignForm.assigned_username}
                onChange={(e) => setAssignForm({...assignForm, assigned_username: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Department</label>
              <input
                type="text"
                className="form-input"
                value={assignForm.department}
                onChange={(e) => setAssignForm({...assignForm, department: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Location</label>
              <select
                className="form-select"
                value={assignForm.location}
                onChange={(e) => setAssignForm({...assignForm, location: e.target.value})}
                style={{ width: '100%' }}
              >
                {LOCATION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={assignForm.assignment_override}
                  onChange={(e) => setAssignForm({...assignForm, assignment_override: e.target.checked})}
                />
                <span className="form-label" style={{ marginBottom: 0 }}>Override Fleet Auto-Sync</span>
              </label>
              <div className="text-sm text-muted">Prevent Fleet from automatically changing this assignment</div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleAssign} className="btn btn-primary">
                Assign
              </button>
              <button onClick={() => setShowAssignModal(false)} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetDetail;
