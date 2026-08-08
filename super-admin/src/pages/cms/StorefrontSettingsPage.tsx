import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cmsApi } from '../../api';
import { Save, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Alert, ConfirmModal } from '../../components/ui';

export default function StorefrontSettingsPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'hero' | 'features' | 'stats'>('hero');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Data States
  const [heroConfig, setHeroConfig] = useState<any>({
    title: '', subtitle: '', badgeText: '',
    floatingCards: [], featureChips: [], trustItems: []
  });
  const [features, setFeatures] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ products: 0, customers: 0, orders: 0, yearsInBusiness: 0 });

  const { data, isLoading } = useQuery({
    queryKey: ['sa-cms-settings'],
    queryFn: () => cmsApi.settings.get(),
  });

  useEffect(() => {
    if (data?.data) {
      if (data.data.HERO_CONFIG) setHeroConfig(data.data.HERO_CONFIG as any);
      if (data.data.STORE_FEATURES) setFeatures(data.data.STORE_FEATURES as any[]);
      if (data.data.STATISTICS) setStats(data.data.STATISTICS as any);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (body: any) => cmsApi.settings.update(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-cms-settings'] });
      alert('Settings saved successfully!');
    },
    onError: (err: any) => setErrorMsg(err.message || 'Failed to save settings')
  });

  const handleSave = () => {
    saveMutation.mutate({
      HERO_CONFIG: heroConfig,
      STORE_FEATURES: features,
      STATISTICS: stats
    });
  };

  if (isLoading) return <div className="sa-p-24">Loading settings...</div>;

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>Storefront Settings</h1>
          <p>Manage landing page configurations, hero section, features, and statistics.</p>
        </div>
        <button className="sa-btn sa-btn-primary" onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving...' : <Save size={16} />} Save Changes
        </button>
      </div>

      {errorMsg && <div className="sa-mb-16"><Alert type="danger" title="Error" message={errorMsg} /></div>}

      <div className="sa-tabs sa-mb-16">
        <button className={`sa-tab ${activeTab === 'hero' ? 'active' : ''}`} onClick={() => setActiveTab('hero')}>Hero Section</button>
        <button className={`sa-tab ${activeTab === 'features' ? 'active' : ''}`} onClick={() => setActiveTab('features')}>Store Features</button>
        <button className={`sa-tab ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>Statistics</button>
      </div>

      <div className="sa-card sa-p-24">
        {activeTab === 'hero' && (
          <div className="sa-space-y-24">
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>Main Content</h3>
            <div className="sa-form-group">
              <label className="sa-label">Badge Text</label>
              <input className="sa-input" value={heroConfig.badgeText || ''} onChange={e => setHeroConfig({...heroConfig, badgeText: e.target.value})} placeholder="Premium Marketplace for East Africa" />
            </div>
            <div className="sa-form-row">
              <div className="sa-form-group">
                <label className="sa-label">Main Title</label>
                <input className="sa-input" value={heroConfig.title || ''} onChange={e => setHeroConfig({...heroConfig, title: e.target.value})} placeholder="Discover Quality Products" />
              </div>
              <div className="sa-form-group">
                <label className="sa-label">Subtitle</label>
                <input className="sa-input" value={heroConfig.subtitle || ''} onChange={e => setHeroConfig({...heroConfig, subtitle: e.target.value})} placeholder="Shop with confidence..." />
              </div>
            </div>

            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 8, marginTop: 32 }}>Floating Product Cards</h3>
            {(heroConfig.floatingCards || []).map((card: any, idx: number) => (
              <div key={idx} className="sa-form-row sa-mb-8" style={{ alignItems: 'flex-end', background: 'var(--surface-color)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <div className="sa-form-group"><label className="sa-label">Icon Name</label><input className="sa-input" value={card.icon} onChange={e => { const nc = [...heroConfig.floatingCards]; nc[idx].icon = e.target.value; setHeroConfig({...heroConfig, floatingCards: nc}); }} placeholder="Smartphone" /></div>
                <div className="sa-form-group"><label className="sa-label">Label</label><input className="sa-input" value={card.label} onChange={e => { const nc = [...heroConfig.floatingCards]; nc[idx].label = e.target.value; setHeroConfig({...heroConfig, floatingCards: nc}); }} /></div>
                <div className="sa-form-group"><label className="sa-label">Price</label><input className="sa-input" value={card.price} onChange={e => { const nc = [...heroConfig.floatingCards]; nc[idx].price = e.target.value; setHeroConfig({...heroConfig, floatingCards: nc}); }} /></div>
                <div className="sa-form-group"><label className="sa-label">Color Hex</label><input className="sa-input" type="color" value={card.color} onChange={e => { const nc = [...heroConfig.floatingCards]; nc[idx].color = e.target.value; setHeroConfig({...heroConfig, floatingCards: nc}); }} /></div>
                <button className="sa-btn sa-btn-icon" style={{ color: 'var(--danger)', marginBottom: 4 }} onClick={() => { const nc = [...heroConfig.floatingCards]; nc.splice(idx, 1); setHeroConfig({...heroConfig, floatingCards: nc}); }}><Trash2 size={16} /></button>
              </div>
            ))}
            <button className="sa-btn sa-btn-ghost sa-btn-sm" onClick={() => setHeroConfig({...heroConfig, floatingCards: [...(heroConfig.floatingCards || []), { icon: 'Smartphone', label: '', price: '', color: '#3b82f6', delay: 0 }]})}><Plus size={14} /> Add Card</button>

            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 8, marginTop: 32 }}>Trust Items (Bottom of Hero)</h3>
            {(heroConfig.trustItems || []).map((item: any, idx: number) => (
              <div key={idx} className="sa-form-row sa-mb-8" style={{ alignItems: 'flex-end', background: 'var(--surface-color)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <div className="sa-form-group"><label className="sa-label">Icon</label><input className="sa-input" value={item.icon} onChange={e => { const ni = [...heroConfig.trustItems]; ni[idx].icon = e.target.value; setHeroConfig({...heroConfig, trustItems: ni}); }} placeholder="Truck" /></div>
                <div className="sa-form-group"><label className="sa-label">Title</label><input className="sa-input" value={item.title} onChange={e => { const ni = [...heroConfig.trustItems]; ni[idx].title = e.target.value; setHeroConfig({...heroConfig, trustItems: ni}); }} /></div>
                <div className="sa-form-group"><label className="sa-label">Text</label><input className="sa-input" value={item.text} onChange={e => { const ni = [...heroConfig.trustItems]; ni[idx].text = e.target.value; setHeroConfig({...heroConfig, trustItems: ni}); }} /></div>
                <button className="sa-btn sa-btn-icon" style={{ color: 'var(--danger)', marginBottom: 4 }} onClick={() => { const ni = [...heroConfig.trustItems]; ni.splice(idx, 1); setHeroConfig({...heroConfig, trustItems: ni}); }}><Trash2 size={16} /></button>
              </div>
            ))}
            <button className="sa-btn sa-btn-ghost sa-btn-sm" onClick={() => setHeroConfig({...heroConfig, trustItems: [...(heroConfig.trustItems || []), { icon: 'Truck', title: '', text: '' }]})}><Plus size={14} /> Add Trust Item</button>
          </div>
        )}

        {activeTab === 'features' && (
          <div className="sa-space-y-24">
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>Global Store Features</h3>
            {features.map((feat: any, idx: number) => (
              <div key={idx} className="sa-form-row sa-mb-8" style={{ alignItems: 'flex-start', background: 'var(--surface-color)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <div className="sa-form-group"><label className="sa-label">Icon Name</label><input className="sa-input" value={feat.icon} onChange={e => { const nf = [...features]; nf[idx].icon = e.target.value; setFeatures(nf); }} placeholder="Truck" /></div>
                <div className="sa-form-group"><label className="sa-label">Title</label><input className="sa-input" value={feat.title} onChange={e => { const nf = [...features]; nf[idx].title = e.target.value; setFeatures(nf); }} /></div>
                <div className="sa-form-group" style={{ flex: 2 }}><label className="sa-label">Description</label><textarea className="sa-input" value={feat.description} onChange={e => { const nf = [...features]; nf[idx].description = e.target.value; setFeatures(nf); }} rows={2} /></div>
                <button className="sa-btn sa-btn-icon" style={{ color: 'var(--danger)', marginTop: 24 }} onClick={() => { const nf = [...features]; nf.splice(idx, 1); setFeatures(nf); }}><Trash2 size={16} /></button>
              </div>
            ))}
            <button className="sa-btn sa-btn-ghost sa-btn-sm" onClick={() => setFeatures([...features, { icon: 'Truck', title: '', description: '' }])}><Plus size={14} /> Add Feature</button>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="sa-space-y-24">
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>Store Statistics</h3>
            <p className="sa-text-muted sa-mb-16">These numbers are displayed in the Statistics section of the landing page.</p>
            <div className="sa-form-row">
              <div className="sa-form-group">
                <label className="sa-label">Products Count</label>
                <input className="sa-input" type="number" value={stats.products || 0} onChange={e => setStats({...stats, products: parseInt(e.target.value) || 0})} />
              </div>
              <div className="sa-form-group">
                <label className="sa-label">Happy Customers</label>
                <input className="sa-input" type="number" value={stats.customers || 0} onChange={e => setStats({...stats, customers: parseInt(e.target.value) || 0})} />
              </div>
            </div>
            <div className="sa-form-row">
              <div className="sa-form-group">
                <label className="sa-label">Successful Orders</label>
                <input className="sa-input" type="number" value={stats.orders || 0} onChange={e => setStats({...stats, orders: parseInt(e.target.value) || 0})} />
              </div>
              <div className="sa-form-group">
                <label className="sa-label">Years in Business</label>
                <input className="sa-input" type="number" value={stats.yearsInBusiness || 0} onChange={e => setStats({...stats, yearsInBusiness: parseInt(e.target.value) || 0})} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
