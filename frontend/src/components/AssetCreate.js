import React from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Save } from 'lucide-react';
import { apiClient } from '../utils/api';

const AssetCreate = () => {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm();

  const createMutation = useMutation({
    mutationFn: (data) => apiClient.post('/api/assets', data),
    onSuccess: () => {
      toast.success('Asset created successfully!');
      navigate('/assets');
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to create asset');
    }
  });

  const onSubmit = (data) => {
    createMutation.mutate(data);
  };

  return (
    <div>
      <div className="page-header">
        <button onClick={() => navigate(-1)} className="btn btn-secondary btn-sm mb-2">
          <ArrowLeft size={16} />
          Back
        </button>
        <h1 className="page-title">Add New Asset</h1>
        <p className="page-subtitle">Create a new asset record</p>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label">Asset Tag *</label>
              <input
                type="text"
                className="form-input"
                {...register('asset_tag', { required: 'Asset tag is required' })}
              />
              {errors.asset_tag && <span style={{ color: 'var(--color-danger)', fontSize: '13px' }}>{errors.asset_tag.message}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Serial Number *</label>
              <input
                type="text"
                className="form-input"
                {...register('serial_number', { required: 'Serial number is required' })}
              />
              {errors.serial_number && <span style={{ color: 'var(--color-danger)', fontSize: '13px' }}>{errors.serial_number.message}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Manufacturer *</label>
              <select className="form-select" {...register('manufacturer', { required: true })}>
                <option value="">Select manufacturer</option>
                <option value="Apple">Apple</option>
                <option value="Dell">Dell</option>
                <option value="Lenovo">Lenovo</option>
                <option value="HP">HP</option>
                <option value="Microsoft">Microsoft</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Model *</label>
              <input
                type="text"
                className="form-input"
                {...register('model', { required: 'Model is required' })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Device Type *</label>
              <select className="form-select" {...register('device_type', { required: true })}>
                <option value="">Select type</option>
                <option value="laptop">Laptop</option>
                <option value="monitor">Monitor</option>
                <option value="mouse">Mouse</option>
                <option value="keyboard">Keyboard</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">OS Type</label>
              <select className="form-select" {...register('os_type')}>
                <option value="">Select OS</option>
                <option value="macOS">macOS</option>
                <option value="Windows">Windows</option>
                <option value="Linux">Linux</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">OS Version</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Sonoma 14.2"
                {...register('os_version')}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Processor</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., M3 Pro"
                {...register('processor')}
              />
            </div>

            <div className="form-group">
              <label className="form-label">RAM (GB)</label>
              <input
                type="number"
                className="form-input"
                {...register('ram_gb')}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Storage (GB)</label>
              <input
                type="number"
                className="form-input"
                {...register('storage_gb')}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Screen Size (inches)</label>
              <input
                type="number"
                step="0.1"
                className="form-input"
                {...register('screen_size')}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Purchase Date</label>
              <input
                type="date"
                className="form-input"
                {...register('purchase_date')}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Purchase Cost ($)</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                {...register('purchase_cost')}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Supplier</label>
              <input
                type="text"
                className="form-input"
                {...register('supplier')}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Warranty Expiration</label>
              <input
                type="date"
                className="form-input"
                {...register('warranty_expiration')}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              className="form-textarea"
              placeholder="Any additional notes..."
              {...register('notes')}
            />
          </div>

          <div className="flex gap-2 mt-4">
            <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
              <Save size={18} />
              {createMutation.isPending ? 'Creating...' : 'Create Asset'}
            </button>
            <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssetCreate;
