import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { settingsApi, type PlatformSetting } from '../api';
import { Alert } from '../components/ui';
import { Save, RefreshCw, Eye, EyeOff, Shield } from 'lucide-react';

interface SettingGroup {
  label: string;
  description: string;
  keys: Array<{ key: string; label: string; type?: string; placeholder?: string }>;
}

const SETTING_GROUPS: SettingGroup[] = [
  {
    label: 'Platform Identity',
    description: 'Basic platform branding and contact information',
    keys: [
      { key: 'platform_name', label: 'Platform Name', placeholder: 'HQ Investment' },
      { key: 'platform_support_email', label: 'Support Email', type: 'email', placeholder: 'support@platform.com' },
      { key: 'platform_support_phone', label: 'Support Phone', placeholder: '+255 712 000 000' },
      { key: 'platform_trial_days', label: 'Trial Period (days)', type: 'number', placeholder: '10' },
      { key: 'platform_currency', label: 'Default Currency', placeholder: 'TZS' },
      { key: 'platform_timezone', label: 'Timezone', placeholder: 'Africa/Dar_es_Salaam' },
    ],
  },
  {
    label: 'Email / SMTP',
    description: 'Configure outgoing email for tenant notifications',
    keys: [
      { key: 'platform_smtp_host', label: 'SMTP Host', placeholder: 'smtp.gmail.com' },
      { key: 'platform_smtp_port', label: 'SMTP Port', type: 'number', placeholder: '587' },
      { key: 'platform_smtp_user', label: 'SMTP User', placeholder: 'no-reply@platform.com' },
      { key: 'platform_smtp_password', label: 'SMTP Password', type: 'password', placeholder: '••••••••' },
      { key: 'platform_smtp_from_name', label: 'From Name', placeholder: 'HQ Platform' },
      { key: 'platform_smtp_from_email', label: 'From Email', type: 'email', placeholder: 'no-reply@platform.com' },
    ],
  },
  {
    label: 'SMS Gateway',
    description: 'Configure SMS provider for license and alert notifications to tenants',
    keys: [
      { key: 'platform_sms_provider', label: 'SMS Provider', placeholder: 'e.g. Bongoms, AfricasTalking' },
      { key: 'platform_sms_api_key', label: 'SMS API Key', type: 'password', placeholder: '••••••••••••' },
      { key: 'platform_sms_sender_id', label: 'Sender ID', placeholder: 'HQPLATFORM' },
    ],
  },
  {
    label: 'HarakaPay Gateway',
    description: 'Payment gateway for receiving tenant license payments',
    keys: [
      { key: 'platform_harakapay_api_key', label: 'API Key', type: 'password', placeholder: '••••••••••••' },
      { key: 'platform_harakapay_secret', label: 'Secret Key', type: 'password', placeholder: '••••••••••••' },
      { key: 'platform_harakapay_callback_url', label: 'Callback URL', placeholder: 'https://api.platform.com/webhooks/harakapay' },
    ],
  },
  {
    label: 'ZenoPay Gateway',
    description: 'Alternative payment gateway for mobile money',
    keys: [
      { key: 'platform_zenopay_account', label: 'Account ID', placeholder: 'ZENO_ACCT_ID' },
      { key: 'platform_zenopay_api_key', label: 'API Key', type: 'password', placeholder: '••••••••••••' },
      { key: 'platform_zenopay_callback_url', label: 'Callback URL', placeholder: 'https://api.platform.com/webhooks/zenopay' },
    ],
  },
  {
    label: 'PalmPesa Gateway',
    description: 'Mobile money gateway integration',
    keys: [
      { key: 'platform_palmpesa_account', label: 'Account ID', placeholder: 'PALMPESA_ACCT_ID' },
      { key: 'platform_palmpesa_api_key', label: 'API Key', type: 'password', placeholder: '••••••••••••' },
      { key: 'platform_palmpesa_secret', label: 'Secret Key', type: 'password', placeholder: '••••••••••••' },
      { key: 'platform_palmpesa_callback_url', label: 'Callback URL', placeholder: 'https://api.platform.com/webhooks/palmpesa' },
    ],
  },
];

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sa-settings'],
    queryFn: settingsApi.get,
  });

  // Initialize form values from fetched settings
  useEffect(() => {
    if (data?.data) {
      const map: Record<string, string> = {};
      data.data.forEach((s: PlatformSetting) => {
        // Don't populate masked values (they show as bullets)
        if (!s.value.includes('•')) map[s.key] = s.value;
      });
      setValues(prev => ({ ...prev, ...map }));
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const toSave = Array.from(dirtyKeys)
        .filter(k => values[k] !== undefined && values[k] !== '')
        .map(k => ({
          key: k,
          value: values[k],
          group: SETTING_GROUPS.find(g => g.keys.some(f => f.key === k))?.label.toLowerCase().replace(/\s+/g, '_') || 'platform',
        }));
      if (toSave.length === 0) throw new Error('No changes to save');
      return settingsApi.save(toSave);
    },
    onSuccess: (res) => {
      setMsg(res.message);
      setDirtyKeys(new Set());
      refetch();
      setTimeout(() => setMsg(''), 4000);
    },
    onError: (e: Error) => {
      setError(e.message);
      setTimeout(() => setError(''), 4000);
    },
  });

  const handleChange = (key: string, val: string) => {
    setValues(prev => ({ ...prev, [key]: val }));
    setDirtyKeys(prev => new Set(prev).add(key));
  };

  const togglePassword = (key: string) => {
    setShowPasswords(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isPassword = (f: { type?: string }) => f.type === 'password';

  if (isLoading) {
    return (
      <div className="sa-loading-center">
        <div className="sa-spinner" />
        <span>Loading platform settings…</span>
      </div>
    );
  }

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Platform <span className="sa-gradient-text">Settings</span></h1>
          <p>Configure payment gateways, SMTP, SMS, and platform preferences</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="sa-btn sa-btn-ghost" onClick={() => refetch()}><RefreshCw size={14} /> Reload</button>
          <button
            className="sa-btn sa-btn-primary"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || dirtyKeys.size === 0}
          >
            {saveMutation.isPending ? <span className="sa-spinner sa-spinner-sm" /> : <Save size={14} />}
            Save {dirtyKeys.size > 0 ? `(${dirtyKeys.size} change${dirtyKeys.size > 1 ? 's' : ''})` : 'Settings'}
          </button>
        </div>
      </div>

      {/* Privacy notice */}
      <div className="sa-privacy-banner sa-mb-24">
        <Shield size={14} />
        Platform settings apply globally. These are NOT tenant-specific settings — each tenant manages their own gateway and SMTP configuration independently.
      </div>

      {msg && <Alert type="success" title={msg} />}
      {error && <Alert type="danger" title={error} />}

      {/* Setting Groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {SETTING_GROUPS.map(group => (
          <div key={group.label} className="sa-card">
            <div className="sa-card-header">
              <div>
                <div className="sa-card-title">{group.label}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                  {group.description}
                </div>
              </div>
            </div>
            <div className="sa-grid-2" style={{ gap: 16 }}>
              {group.keys.map(field => (
                <div key={field.key} className="sa-form-group" style={{ marginBottom: 0 }}>
                  <label className="sa-label" htmlFor={field.key}>
                    {field.label}
                    {dirtyKeys.has(field.key) && (
                      <span style={{ marginLeft: 6, color: 'var(--warning)', fontSize: 9 }}>● UNSAVED</span>
                    )}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id={field.key}
                      className="sa-input"
                      type={isPassword(field) && !showPasswords[field.key] ? 'password' : field.type === 'password' ? 'text' : (field.type || 'text')}
                      placeholder={field.placeholder}
                      value={values[field.key] || ''}
                      onChange={e => handleChange(field.key, e.target.value)}
                      style={isPassword(field) ? { paddingRight: 40 } : undefined}
                      autoComplete="off"
                    />
                    {isPassword(field) && (
                      <button
                        type="button"
                        onClick={() => togglePassword(field.key)}
                        style={{
                          position: 'absolute',
                          right: 10,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          padding: 4,
                          color: 'var(--text-muted)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                        title={showPasswords[field.key] ? 'Hide' : 'Show'}
                      >
                        {showPasswords[field.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Floating save bar (if unsaved changes) */}
      {dirtyKeys.size > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-active)',
          borderRadius: 'var(--r-lg)',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: 'var(--shadow-lg)',
          zIndex: 200,
          animation: 'modal-slide 0.2s ease',
        }}>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
            {dirtyKeys.size} unsaved change{dirtyKeys.size > 1 ? 's' : ''}
          </span>
          <button className="sa-btn sa-btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <span className="sa-spinner sa-spinner-sm" /> : <Save size={13} />}
            Save Now
          </button>
        </div>
      )}
    </div>
  );
}
