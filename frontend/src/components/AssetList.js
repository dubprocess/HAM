import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Filter, Plus, Eye, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MapPin } from 'lucide-react';
import { apiClient } from '../utils/api';

// Platform icon components
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

const IPhoneIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 320 512" fill="#1d1d1f">
    <path d="M272 0H48C21.5 0 0 21.5 0 48v416c0 26.5 21.5 48 48 48h224c26.5 0 48-21.5 48-48V48c0-26.5-21.5-48-48-48zM160 480c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32z"/>
  </svg>
);

const IPadIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 448 512" fill="#1d1d1f">
    <path d="M400 0H48C21.5 0 0 21.5 0 48v416c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48V48c0-26.5-21.5-48-48-48zM224 480c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32z"/>
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
  { value: 'iOS', label: 'iOS', icon: IPhoneIcon },
  { value: 'iPadOS', label: 'iPadOS', icon: IPadIcon },
  { value: 'tvOS', label: 'tvOS', icon: TvIcon },
];

const locationOptions = [
  { value: '', label: 'All Locations' },
  { value: 'NYC', label: 'NYC — New York' },
  { value: 'SFO', label: 'SFO — San Francisco' },
  { value: 'ORD', label: 'ORD — Chicago' },
  { value: 'BEL', label: 'BEL — Belgrade' },
  { value: 'Remote', label: 'Remote' },
];

const PAGE_SIZE = 50;

const AssetList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [warrantyFilter, setWarrantyFilter] = useState('');
  const [fleetFilter, setFleetFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const status = searchParams.get('status');
    const warranty = searchParams.get('warranty');
    const fleet = searchParams.get('fleet');
    const platform = searchParams.get('platform');
    const location = searchParams.get('location');
    const page = searchParams.get('page');
    if (status) setStatusFilter(status);
    if (warranty) setWarrantyFilter(warranty);
    if (fleet) setFleetFilter(fleet);
    if (platform) setPlatformFilter(platform);
    if (location) setLocationFilter(location);
    if (page) setCurrentPage(parseInt(page, 10));
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, platformFilter, locationFilter, warrantyFilter, fleetFilter]);

  const getActiveFilterLabel = () => {
    if (warrantyFilter === 'expiring') return 'Warranty Expiring Soon';
    if (fleetFilter === 'enrolled') return 'Fleet Enrolled';
    return null;
  };

  const clearSpecialFilters = () => {
    setWarrantyFilter('');
    setFleetFilter('');
    setSearchParams({});
  };

  const skip = (currentPage - 1) * PAGE_SIZE;

  const { data, isLoading } = useQuery({
    queryKey: ['assets', search, statusFilter, platformFilter, locationFilter, warrantyFilter, fleetFilter, currentPage],
    queryFn: () => apiClient.get('/api/assets', {
      params: {
        search, status: statusFilter || undefined,
        platform: platformFilter || undefined,
        location: locationFilter || undefined,
        warranty: warrantyFilter || undefined,
        fleet: fleetFilter || undefined,
        skip, limit: PAGE_SIZE
      }
    })
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  const goToPage = (page) => {
    const newPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 7;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
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

  const getStatusBadge = (status) => {
    const badges = {
      available: 'badge-success',
      assigned: 'badge-info',
      locked: 'badge-danger',
      retired: 'badge-secondary',
      lost: 'badge-danger'
    };
    return badges[status] || 'badge-secondary';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const activeFilterLabel = getActiveFilterLabel();
  const selectedPlatform = platformOptions.find(p => p.value === platformFilter);

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
                <button onClick={clearSpecialFilters} style={{ marginLeft: '8px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: '#6b7280', fontSize: '14px' }}>{'\u00d7'}</button>
              </span>
            )}
          </p>
        </div>
        <Link to="/assets/new" className="btn btn-primary"><Plus size={18} />Add Asset</Link>
        <button onClick={() => window.open('http://localhost:8000/api/assets/export/csv', '_blank')} className="btn btn-secondary"><Download size={18} />Export CSV</button>
      </div>

      <div className="card" style={{ marginBottom: '24px', padding: '20px 24px' }}>
        <div className="flex gap-2 items-center">
          <div className="form-group flex-1" style={{ marginBottom: 0 }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
              <input type="text" className="form-input" placeholder="Search by asset tag, serial, model, or assignee..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: '40px' }} />
            </div>
          </div>
          <select className="form-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setWarrantyFilter(''); setFleetFilter(''); setSearchParams(e.target.value ? { status: e.target.value } : {}); }} style={{ width: '200px' }}>
            <option value="">All Statuses</option>
            <option value="available">Available</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
            <option value="locked">Locked</option>
            <option value="retired">Retired</option>
          </select>

          <div style={{ position: 'relative', width: '200px' }}>
            {selectedPlatform?.icon && (
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', zIndex: 1, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                <selectedPlatform.icon size={14} />
              </span>
            )}
            <select className="form-select" value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} style={{ width: '100%', paddingLeft: selectedPlatform?.icon ? '32px' : undefined }}>
              {platformOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
            </select>
          </div>

          <div style={{ position: 'relative', width: '200px' }}>
            {locationFilter && (
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', zIndex: 1, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                <MapPin size={14} color="#6b7280" />
              </span>
            )}
            <select className="form-select" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} style={{ width: '100%', paddingLeft: locationFilter ? '32px' : undefined }}>
              {locationOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="loading">Loading assets...</div>
      ) : data?.assets?.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">{'\ud83d\udce6'}</div>
          <h3 className="empty-state-title">No assets found</h3>
          <p className="empty-state-description">
            {search || statusFilter || platformFilter || locationFilter || warrantyFilter || fleetFilter ? 'Try adjusting your filters' : 'Get started by adding your first asset'}
          </p>
          <Link to="/assets/new" className="btn btn-primary"><Plus size={18} />Add First Asset</Link>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Asset Tag</th>
                  <th>Device</th>
                  <th>Serial Number</th>
                  <th>Assigned To</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Last Seen</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.assets?.map((asset) => (
                  <tr key={asset.id}>
                    <td className="mono">{asset.asset_tag}</td>
                    <td style={{ maxWidth: '280px' }}>
                      <div style={{ fontWeight: 600 }}>{asset.manufacturer} {asset.model}</div>
                      <div className="text-sm text-muted">{asset.os_type} {asset.os_version}</div>
                    </td>
                    <td className="mono" style={{ fontSize: '13px', color: 'var(--color-text-tertiary)' }}>{asset.serial_number}</td>
                    <td>
                      {asset.assigned_to ? (
                        <>
                          <div style={{ fontSize: '14px' }}>{asset.assigned_to}</div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>{asset.assigned_email}</div>
                        </>
                      ) : asset.assigned_email ? (
                        <>
                          <div style={{ fontSize: '14px' }}>{asset.assigned_email.split('@')[0]}</div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>{asset.assigned_email}</div>
                        </>
                      ) : (
                        <span className="text-muted" style={{ fontSize: '13px' }}>Unassigned</span>
                      )}
                    </td>
                    <td>
                      {asset.location ? (
                        <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151', background: '#f3f4f6', padding: '2px 8px', borderRadius: '4px' }}>{asset.location}</span>
                      ) : (
                        <span className="text-muted" style={{ fontSize: '12px' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(asset.status)}`}>{asset.status}</span>
                      {asset.fleet_enrolled && (
                        <span className="badge badge-info ml-1" title="Enrolled in Fleet MDM">Fleet</span>
                      )}
                    </td>
                    <td className="text-sm">{formatDate(asset.fleet_last_seen)}</td>
                    <td>
                      <Link to={`/assets/${asset.id}`} className="btn btn-sm btn-secondary"><Eye size={14} />View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderTop: '1px solid var(--color-border)' }}>
              <div className="text-sm text-muted">
                Showing {skip + 1}{'\u2013'}{Math.min(skip + PAGE_SIZE, data.total)} of {data.total} assets
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button onClick={() => goToPage(1)} disabled={currentPage === 1} style={{ padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.4 : 1, display: 'flex', alignItems: 'center' }} title="First page"><ChevronsLeft size={16} /></button>
                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} style={{ padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.4 : 1, display: 'flex', alignItems: 'center' }} title="Previous page"><ChevronLeft size={16} /></button>
                {getPageNumbers().map((page, i) => (
                  page === '...' ? (
                    <span key={`ellipsis-${i}`} style={{ padding: '6px 4px', color: 'var(--color-text-tertiary)' }}>{'\u2026'}</span>
                  ) : (
                    <button key={page} onClick={() => goToPage(page)} style={{ padding: '6px 12px', border: '1px solid', borderColor: currentPage === page ? 'var(--color-primary)' : 'var(--color-border)', borderRadius: '6px', background: currentPage === page ? 'var(--color-primary)' : 'white', color: currentPage === page ? 'white' : 'inherit', cursor: 'pointer', fontWeight: currentPage === page ? 600 : 400, fontSize: '14px', minWidth: '36px' }}>{page}</button>
                  )
                ))}
                <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} style={{ padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.4 : 1, display: 'flex', alignItems: 'center' }} title="Next page"><ChevronRight size={16} /></button>
                <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages} style={{ padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.4 : 1, display: 'flex', alignItems: 'center' }} title="Last page"><ChevronsRight size={16} /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AssetList;
