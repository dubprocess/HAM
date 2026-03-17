import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Plus, Eye, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MapPin, ArrowUp, ArrowDown, ArrowUpDown, Clock } from 'lucide-react';
import { apiClient } from '../utils/api';

const AppleIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 384 512" fill="#1d1d1f">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
  </svg>
);

const WindowsIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 448 512" fill="#0078d4">
    <path d="M0 93.7l183.6-25.3v177.4H0V93.7zm0 324.6l183.6 25.3V268.4H0v149.9zm203.8 28L448 480V268.4H203.8v177.9zm0-380.6v180.1H448V32L203.8 65.7z"/>
  </svg>
);

const TvIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 640 512" fill="#1d1d1f">
    <path d="M592 0H48C21.5 0 0 21.5 0 48v320c0 26.5 21.5 48 48 48h245.1v32h-160c-17.7 0-32 14.3-32 32s14.3 32 32 32h384c17.7 0 32-14.3 32-32s-14.3-32-32-32h-160v-32H592c26.5 0 48-21.5 48-48V48c0-26.5-21.5-48-48-48z"/>
  </svg>
);

const platformOptions = [
  { value: '', label: 'All Platforms', icon: null },
  { value: 'macOS', label: 'macOS', icon: AppleIcon },
  { value: 'windows', label: 'Windows', icon: WindowsIcon },
  { value: 'tvOS', label: 'tvOS', icon: TvIcon },
];

// Location options are loaded dynamically from /api/config/locations
// which reads the LOCATIONS env var. Configure in backend/.env:
// LOCATIONS=HQ,Branch,Remote
const DEFAULT_LOCATION_OPTIONS = [
  { value: '', label: 'All Locations' },
  { value: 'HQ', label: 'HQ' },
  { value: 'Remote', label: 'Remote' },
];

const ageOptions = [
  { value: '', label: 'All Ages' },
  { value: '0-1', label: '0\u20131 years' },
  { value: '1-2', label: '1\u20132 years' },
  { value: '2-3', label: '2\u20133 years' },
  { value: '3-4', label: '3\u20134 years' },
  { value: '4+', label: '4+ years' },
];

const PAGE_SIZE = 50;

const CSV_EXPORT_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:8000/api/assets/export/csv'
  : '/api/assets/export/csv';

const SortIcon = ({ column, sortColumn, sortDirection }) => {
  if (sortColumn !== column) return <ArrowUpDown size={14} style={{ opacity: 0.3 }} />;
  return sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
};

const formatDeviceAge = (purchaseDate, abmOrderDate) => {
  const dateStr = purchaseDate || abmOrderDate;
  if (!dateStr) return null;
  const diffDays = Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);
  if (years === 0 && months === 0) return '<1m';
  if (years === 0) return `${months}m`;
  if (months === 0) return `${years}y`;
  return `${years}y ${months}m`;
};

const getAgeColor = (purchaseDate, abmOrderDate) => {
  const dateStr = purchaseDate || abmOrderDate;
  if (!dateStr) return 'inherit';
  const years = (new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24 * 365);
  if (years >= 4) return '#ef4444';
  if (years >= 3) return '#f59e0b';
  return '#10b981';
};

const AssetList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [ageFilter, setAgeFilter] = useState('');
  const [warrantyFilter, setWarrantyFilter] = useState('');
  const [fleetFilter, setFleetFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('desc');
  const [locationOptions, setLocationOptions] = useState(DEFAULT_LOCATION_OPTIONS);

  // Load locations dynamically from backend config
  useEffect(() => {
    const apiBase = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';
    fetch(`${apiBase}/api/config/locations`)
      .then(r => r.json())
      .then(data => {
        if (data.locations && data.locations.length > 0) {
          setLocationOptions([
            { value: '', label: 'All Locations' },
            ...data.locations.map(loc => ({ value: loc, label: loc }))
          ]);
        }
      })
      .catch(() => { /* fallback to defaults */ });
  }, []);

  useEffect(() => {
    const status = searchParams.get('status');
    const warranty = searchParams.get('warranty');
    const fleet = searchParams.get('fleet');
    const platform = searchParams.get('platform');
    const location = searchParams.get('location');
    const age = searchParams.get('age');
    const page = searchParams.get('page');
    if (status) setStatusFilter(status);
    if (warranty) setWarrantyFilter(warranty);
    if (fleet) setFleetFilter(fleet);
    if (platform) setPlatformFilter(platform);
    if (location) setLocationFilter(location);
    if (age) setAgeFilter(age);
    if (page) setCurrentPage(parseInt(page, 10));
  }, []);

  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, platformFilter, locationFilter, ageFilter, warrantyFilter, fleetFilter]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      if (sortDirection === 'desc') setSortDirection('asc');
      else { setSortColumn(null); setSortDirection('desc'); }
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getActiveFilterLabel = () => {
    if (warrantyFilter === 'expiring') return 'Warranty Expiring Soon';
    if (fleetFilter === 'enrolled') return 'Fleet Enrolled';
    return null;
  };

  const clearSpecialFilters = () => { setWarrantyFilter(''); setFleetFilter(''); setSearchParams({}); };

  const skip = (currentPage - 1) * PAGE_SIZE;

  const { data, isLoading } = useQuery({
    queryKey: ['assets', search, statusFilter, platformFilter, locationFilter, ageFilter, warrantyFilter, fleetFilter, currentPage],
    queryFn: () => apiClient.get('/api/assets', {
      params: { search, status: statusFilter || undefined, platform: platformFilter || undefined,
        location: locationFilter || undefined, age: ageFilter || undefined,
        warranty: warrantyFilter || undefined, fleet: fleetFilter || undefined,
        skip, limit: PAGE_SIZE }
    })
  });

  const sortedAssets = useMemo(() => {
    if (!data?.assets || !sortColumn) return data?.assets || [];
    return [...data.assets].sort((a, b) => {
      let valA, valB;
      switch (sortColumn) {
        case 'last_seen': valA = a.fleet_last_seen ? new Date(a.fleet_last_seen).getTime() : 0; valB = b.fleet_last_seen ? new Date(b.fleet_last_seen).getTime() : 0; break;
        case 'asset_tag': valA = (a.asset_tag || '').toLowerCase(); valB = (b.asset_tag || '').toLowerCase(); break;
        case 'assigned_to': valA = (a.assigned_to || a.assigned_email || '').toLowerCase(); valB = (b.assigned_to || b.assigned_email || '').toLowerCase(); break;
        case 'status': valA = (a.status || '').toLowerCase(); valB = (b.status || '').toLowerCase(); break;
        case 'location': valA = (a.location || '').toLowerCase(); valB = (b.location || '').toLowerCase(); break;
        case 'age': valA = new Date(a.purchase_date || a.abm_order_date || '2099-01-01').getTime(); valB = new Date(b.purchase_date || b.abm_order_date || '2099-01-01').getTime(); break;
        default: return 0;
      }
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data?.assets, sortColumn, sortDirection]);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
    else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const getStatusBadge = (status) => ({
    available: 'badge-success', assigned: 'badge-info',
    locked: 'badge-danger', retired: 'badge-secondary', lost: 'badge-danger'
  }[status] || 'badge-secondary');

  const formatDate = (d) => d ? new Date(d).toLocaleDateString() : '-';
  const activeFilterLabel = getActiveFilterLabel();
  const selectedPlatform = platformOptions.find(p => p.value === platformFilter);
  const sortableHeaderStyle = { cursor: 'pointer', userSelect: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' };

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Assets</h1>
          <p className="page-subtitle">
            {data?.total || 0} total assets
            {activeFilterLabel && (
              <span style={{ marginLeft: '12px', background: '#f3f4f6', padding: '4px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 600 }}>
                {activeFilterLabel}
                <button onClick={clearSpecialFilters} style={{ marginLeft: '8px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: '#6b7280', fontSize: '14px' }}>×</button>
              </span>
            )}
          </p>
        </div>
        <Link to="/assets/new" className="btn btn-primary"><Plus size={18} />Add Asset</Link>
        <button onClick={() => window.open(CSV_EXPORT_URL, '_blank')} className="btn btn-secondary"><Download size={18} />Export CSV</button>
      </div>

      <div className="card" style={{ marginBottom: '24px', padding: '20px 24px' }}>
        <div className="flex gap-2 items-center" style={{ flexWrap: 'wrap' }}>
          <div className="form-group flex-1" style={{ marginBottom: 0, minWidth: '200px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
              <input type="text" className="form-input" placeholder="Search by asset tag, serial, model, or assignee..."
                value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: '40px' }} />
            </div>
          </div>

          <select className="form-select" value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setWarrantyFilter(''); setFleetFilter(''); setSearchParams(e.target.value ? { status: e.target.value } : {}); }}
            style={{ width: '160px' }}>
            <option value="">All Statuses</option>
            <option value="available">Available</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
            <option value="locked">Locked</option>
            <option value="retired">Retired</option>
          </select>

          <div style={{ position: 'relative', width: '160px' }}>
            {selectedPlatform?.icon && (
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', zIndex: 1, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                <selectedPlatform.icon size={14} />
              </span>
            )}
            <select className="form-select" value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}
              style={{ width: '100%', paddingLeft: selectedPlatform?.icon ? '32px' : undefined }}>
              {platformOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <div style={{ position: 'relative', width: '160px' }}>
            {locationFilter && (
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', zIndex: 1, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                <MapPin size={14} color="#6b7280" />
              </span>
            )}
            <select className="form-select" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}
              style={{ width: '100%', paddingLeft: locationFilter ? '32px' : undefined }}>
              {locationOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <div style={{ position: 'relative', width: '140px' }}>
            {ageFilter && (
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', zIndex: 1, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                <Clock size={14} color="#6b7280" />
              </span>
            )}
            <select className="form-select" value={ageFilter} onChange={(e) => setAgeFilter(e.target.value)}
              style={{ width: '100%', paddingLeft: ageFilter ? '32px' : undefined }}>
              {ageOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="loading">Loading assets...</div>
      ) : data?.assets?.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📦</div>
          <h3 className="empty-state-title">No assets found</h3>
          <p className="empty-state-description">
            {search || statusFilter || platformFilter || locationFilter || ageFilter || warrantyFilter || fleetFilter
              ? 'Try adjusting your filters' : 'Get started by adding your first asset'}
          </p>
          <Link to="/assets/new" className="btn btn-primary"><Plus size={18} />Add First Asset</Link>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th><span style={sortableHeaderStyle} onClick={() => handleSort('asset_tag')}>Asset Tag <SortIcon column="asset_tag" sortColumn={sortColumn} sortDirection={sortDirection} /></span></th>
                  <th>Device</th>
                  <th>Serial Number</th>
                  <th><span style={sortableHeaderStyle} onClick={() => handleSort('assigned_to')}>Assigned To <SortIcon column="assigned_to" sortColumn={sortColumn} sortDirection={sortDirection} /></span></th>
                  <th><span style={sortableHeaderStyle} onClick={() => handleSort('location')}>Location <SortIcon column="location" sortColumn={sortColumn} sortDirection={sortDirection} /></span></th>
                  <th><span style={sortableHeaderStyle} onClick={() => handleSort('status')}>Status <SortIcon column="status" sortColumn={sortColumn} sortDirection={sortDirection} /></span></th>
                  <th><span style={sortableHeaderStyle} onClick={() => handleSort('age')}>Age <SortIcon column="age" sortColumn={sortColumn} sortDirection={sortDirection} /></span></th>
                  <th><span style={sortableHeaderStyle} onClick={() => handleSort('last_seen')}>Last Seen <SortIcon column="last_seen" sortColumn={sortColumn} sortDirection={sortDirection} /></span></th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedAssets.map((asset) => (
                  <tr key={asset.id}>
                    <td className="mono">{asset.asset_tag}</td>
                    <td style={{ maxWidth: '280px' }}>
                      <div style={{ fontWeight: 600 }}>{asset.manufacturer} {asset.model}</div>
                      <div className="text-sm text-muted">{asset.os_type} {asset.os_version}</div>
                    </td>
                    <td className="mono" style={{ fontSize: '13px', color: 'var(--color-text-tertiary)' }}>{asset.serial_number}</td>
                    <td>
                      {asset.assigned_to ? (
                        <><div style={{ fontSize: '14px' }}>{asset.assigned_to}</div><div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>{asset.assigned_email}</div></>
                      ) : asset.assigned_email ? (
                        <><div style={{ fontSize: '14px' }}>{asset.assigned_email.split('@')[0]}</div><div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>{asset.assigned_email}</div></>
                      ) : (
                        <span className="text-muted" style={{ fontSize: '13px' }}>Unassigned</span>
                      )}
                    </td>
                    <td>
                      {asset.location
                        ? <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151', background: '#f3f4f6', padding: '2px 8px', borderRadius: '4px' }}>{asset.location}</span>
                        : <span className="text-muted" style={{ fontSize: '12px' }}>—</span>
                      }
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(asset.status)}`}>{asset.status}</span>
                      {asset.fleet_enrolled && <span className="badge badge-info ml-1" title="Enrolled in Fleet MDM">Fleet</span>}
                    </td>
                    <td>
                      {formatDeviceAge(asset.purchase_date, asset.abm_order_date)
                        ? <span style={{ fontSize: '13px', fontWeight: 600, color: getAgeColor(asset.purchase_date, asset.abm_order_date) }}>{formatDeviceAge(asset.purchase_date, asset.abm_order_date)}</span>
                        : <span className="text-muted" style={{ fontSize: '12px' }}>—</span>
                      }
                    </td>
                    <td className="text-sm">{formatDate(asset.fleet_last_seen)}</td>
                    <td><Link to={`/assets/${asset.id}`} className="btn btn-sm btn-secondary"><Eye size={14} />View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderTop: '1px solid var(--color-border)' }}>
              <div className="text-sm text-muted">Showing {skip + 1}–{Math.min(skip + PAGE_SIZE, data.total)} of {data.total} assets</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button onClick={() => goToPage(1)} disabled={currentPage === 1} style={{ padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.4 : 1, display: 'flex', alignItems: 'center' }}><ChevronsLeft size={16} /></button>
                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} style={{ padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.4 : 1, display: 'flex', alignItems: 'center' }}><ChevronLeft size={16} /></button>
                {getPageNumbers().map((page, i) => (
                  page === '...'
                    ? <span key={`e-${i}`} style={{ padding: '6px 4px', color: 'var(--color-text-tertiary)' }}>…</span>
                    : <button key={page} onClick={() => goToPage(page)} style={{ padding: '6px 12px', border: '1px solid', borderColor: currentPage === page ? 'var(--color-primary)' : 'var(--color-border)', borderRadius: '6px', background: currentPage === page ? 'var(--color-primary)' : 'white', color: currentPage === page ? 'white' : 'inherit', cursor: 'pointer', fontWeight: currentPage === page ? 600 : 400, fontSize: '14px', minWidth: '36px' }}>{page}</button>
                ))}
                <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} style={{ padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.4 : 1, display: 'flex', alignItems: 'center' }}><ChevronRight size={16} /></button>
                <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages} style={{ padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.4 : 1, display: 'flex', alignItems: 'center' }}><ChevronsRight size={16} /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AssetList;
