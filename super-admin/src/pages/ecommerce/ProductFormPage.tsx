import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ecommerceApi, type Product, type ProductCategory } from '../../api';
import { ArrowLeft, Save, Plus, Trash2, Tag, BarChart3, ImagePlus, Package, DollarSign, Settings, Search } from 'lucide-react';
import { Alert } from '../../components/ui';

const CURRENCIES = ['TZS', 'USD', 'KES', 'UGX', 'ETB'];
const DISCOUNT_TYPES = [
  { value: 'percent', label: 'Percentage (%)' },
  { value: 'fixed', label: 'Fixed Amount' },
];
const STATUSES = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
];

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="sa-card sa-mb-16">
      <div className="sa-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={16} style={{ opacity: 0.6 }} />
        <span className="sa-card-title">{title}</span>
      </div>
      <div className="sa-card-body">{children}</div>
    </div>
  );
}

export default function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEditing = id !== 'new' && !!id;

  const [formData, setFormData] = useState<any>({
    name: '',
    slug: '',
    sku: '',
    categoryId: '',
    price: '',
    discountType: 'percent',
    discountValue: '',
    currency: 'TZS',
    quantity: 0,
    description: '',
    status: 'DRAFT',
    featured: false,
    trending: false,
    flashSale: false,
    bestSeller: false,
    metaTitle: '',
    metaDescription: '',
    tags: '',
    images: [],
  });

  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageAlt, setNewImageAlt] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const set = (field: string, value: any) =>
    setFormData((prev: any) => ({ ...prev, [field]: value }));

  // Fetch categories
  const { data: catData } = useQuery({
    queryKey: ['sa-ecommerce-categories'],
    queryFn: () => ecommerceApi.categories.list(),
  });
  const categories: ProductCategory[] = catData?.data ?? [];

  // Fetch existing product when editing
  const { data: prodData, isLoading: prodLoading } = useQuery({
    queryKey: ['sa-ecommerce-product', id],
    queryFn: () => ecommerceApi.products.get(id as string),
    enabled: isEditing,
  });

  useEffect(() => {
    if (isEditing && prodData?.data) {
      const p = prodData.data as any;
      setFormData({
        name: p.name ?? '',
        slug: p.slug ?? '',
        sku: p.sku ?? '',
        categoryId: p.categoryId ?? '',
        price: p.price ?? '',
        discountType: p.discountType ?? 'percent',
        discountValue: p.discountValue ?? '',
        currency: p.currency ?? 'TZS',
        quantity: p.quantity ?? 0,
        description: p.description ?? '',
        status: p.status ?? 'DRAFT',
        featured: !!p.featured,
        trending: !!p.trending,
        flashSale: !!p.flashSale,
        bestSeller: !!p.bestSeller,
        metaTitle: p.metaTitle ?? '',
        metaDescription: p.metaDescription ?? '',
        tags: Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags ?? ''),
        images: p.images ?? [],
      });
    }
  }, [prodData, isEditing]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (body: any) =>
      isEditing
        ? ecommerceApi.products.update(id as string, body)
        : ecommerceApi.products.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-ecommerce-products'] });
      navigate('/ecommerce/products');
    },
    onError: (err: any) => setErrorMsg(err.message ?? 'Failed to save product'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    saveMutation.mutate({
      ...formData,
      price: parseFloat(formData.price) || 0,
      quantity: parseInt(formData.quantity, 10) || 0,
      discountValue: formData.discountValue !== '' ? parseFloat(formData.discountValue) : null,
      tags: formData.tags
        ? formData.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
        : [],
    });
  };

  // Auto-slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    if (!isEditing) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      setFormData((p: any) => ({ ...p, name, slug }));
    } else {
      set('name', name);
    }
  };

  const handleAddImage = () => {
    if (!newImageUrl) return;
    setFormData((prev: any) => ({
      ...prev,
      images: [
        ...prev.images,
        { url: newImageUrl, altText: newImageAlt || prev.name, isFeatured: prev.images.length === 0 },
      ],
    }));
    setNewImageUrl('');
    setNewImageAlt('');
  };

  const handleRemoveImage = (index: number) =>
    setFormData((prev: any) => ({
      ...prev,
      images: prev.images.filter((_: any, i: number) => i !== index),
    }));

  const handleSetFeaturedImage = (index: number) =>
    setFormData((prev: any) => ({
      ...prev,
      images: prev.images.map((img: any, i: number) => ({ ...img, isFeatured: i === index })),
    }));

  if (isEditing && prodLoading) {
    return (
      <div className="sa-text-center sa-p-24">
        <div className="sa-spinner" style={{ margin: '0 auto 12px' }} />
        Loading product&hellip;
      </div>
    );
  }

  const inputCls = 'sa-input';

  return (
    <div>
      {/* Page header */}
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <button className="sa-btn sa-btn-icon sa-text-muted" onClick={() => navigate('/ecommerce/products')}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>{isEditing ? 'Edit Product' : 'New Product'}</h1>
            {isEditing && <p className="sa-text-muted" style={{ fontSize: 'var(--font-size-sm)', marginTop: 2 }}>ID: {id}</p>}
          </div>
        </div>
        <button type="submit" form="product-form" className="sa-btn sa-btn-primary" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <span className="sa-spinner-sm sa-spinner" /> : <Save size={16} />}
          {isEditing ? 'Update Product' : 'Create Product'}
        </button>
      </div>

      {errorMsg && (
        <div className="sa-mb-16">
          <Alert type="danger" title="Save Error" message={errorMsg} />
        </div>
      )}

      <form id="product-form" onSubmit={handleSubmit} className="sa-grid-3">
        {/* ─── LEFT: Main content (span 2) ───────────── */}
        <div style={{ gridColumn: 'span 2' }}>
          <SectionCard title="Basic Details" icon={Package}>
            <div className="sa-form-group">
              <label className="sa-label">Product Name *</label>
              <input className={inputCls} value={formData.name} onChange={handleNameChange} required placeholder="e.g. Samsung Galaxy A55 5G" />
            </div>
            <div className="sa-form-row">
              <div className="sa-form-group">
                <label className="sa-label">Slug *</label>
                <input className={inputCls} value={formData.slug} onChange={e => set('slug', e.target.value)} required placeholder="samsung-galaxy-a55" />
              </div>
              <div className="sa-form-group">
                <label className="sa-label">SKU</label>
                <input className={inputCls} value={formData.sku} onChange={e => set('sku', e.target.value)} placeholder="SKU-001" />
              </div>
            </div>
            <div className="sa-form-group">
              <label className="sa-label">Description</label>
              <textarea className={inputCls} rows={5} value={formData.description} onChange={e => set('description', e.target.value)} placeholder="Full product description shown on product page..." />
            </div>
            <div className="sa-form-group">
              <label className="sa-label">Tags <span className="sa-text-muted">(comma-separated)</span></label>
              <input className={inputCls} value={formData.tags} onChange={e => set('tags', e.target.value)} placeholder="smartphone, 5G, Samsung, Android" />
            </div>
          </SectionCard>

          <SectionCard title="Product Images" icon={ImagePlus}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className={inputCls}
                placeholder="Image URL (https://...)"
                value={newImageUrl}
                onChange={e => setNewImageUrl(e.target.value)}
                style={{ flex: 2 }}
              />
              <input
                className={inputCls}
                placeholder="Alt text (optional)"
                value={newImageAlt}
                onChange={e => setNewImageAlt(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="button" className="sa-btn sa-btn-ghost" onClick={handleAddImage}>
                <Plus size={15} /> Add
              </button>
            </div>
            {formData.images.length > 0 && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
                {formData.images.map((img: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      position: 'relative', width: 90, height: 90,
                      border: img.isFeatured ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                      borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                    }}
                    onClick={() => handleSetFeaturedImage(i)}
                    title={img.isFeatured ? 'Featured image' : 'Click to set as featured'}
                  >
                    <img src={img.url} alt={img.altText || 'product'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {img.isFeatured && (
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--primary-color)', color: 'white', fontSize: 9, textAlign: 'center', padding: '2px 0', fontWeight: 700 }}>
                        FEATURED
                      </div>
                    )}
                    <button
                      type="button"
                      className="sa-btn sa-btn-icon"
                      style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.55)', color: 'white', width: 22, height: 22 }}
                      onClick={e => { e.stopPropagation(); handleRemoveImage(i); }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="sa-text-muted" style={{ fontSize: 'var(--font-size-xs)', marginTop: 8 }}>
              Click an image to mark it as featured. The featured image appears in product listings.
            </p>
          </SectionCard>

          <SectionCard title="SEO" icon={Search}>
            <div className="sa-form-group">
              <label className="sa-label">Meta Title</label>
              <input className={inputCls} value={formData.metaTitle} onChange={e => set('metaTitle', e.target.value)} placeholder="Defaults to product name if empty" maxLength={70} />
              <p className="sa-text-muted" style={{ fontSize: 'var(--font-size-xs)', marginTop: 4 }}>{formData.metaTitle.length}/70 characters recommended</p>
            </div>
            <div className="sa-form-group">
              <label className="sa-label">Meta Description</label>
              <textarea className={inputCls} rows={3} value={formData.metaDescription} onChange={e => set('metaDescription', e.target.value)} placeholder="Brief description for search engines (150–160 chars recommended)" maxLength={200} />
              <p className="sa-text-muted" style={{ fontSize: 'var(--font-size-xs)', marginTop: 4 }}>{formData.metaDescription.length}/160 characters recommended</p>
            </div>
          </SectionCard>
        </div>

        {/* ─── RIGHT: Sidebar ───────────────────────── */}
        <div>
          <SectionCard title="Pricing &amp; Stock" icon={DollarSign}>
            <div className="sa-form-row">
              <div className="sa-form-group">
                <label className="sa-label">Price *</label>
                <input className={inputCls} type="number" min="0" step="0.01" value={formData.price} onChange={e => set('price', e.target.value)} required placeholder="0.00" />
              </div>
              <div className="sa-form-group">
                <label className="sa-label">Currency</label>
                <select className={inputCls} value={formData.currency} onChange={e => set('currency', e.target.value)}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="sa-form-row">
              <div className="sa-form-group">
                <label className="sa-label">Discount Type</label>
                <select className={inputCls} value={formData.discountType} onChange={e => set('discountType', e.target.value)}>
                  {DISCOUNT_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div className="sa-form-group">
                <label className="sa-label">Discount Value</label>
                <input className={inputCls} type="number" min="0" step="0.01" value={formData.discountValue} onChange={e => set('discountValue', e.target.value)} placeholder={formData.discountType === 'percent' ? 'e.g. 15' : 'e.g. 5000'} />
              </div>
            </div>

            <div className="sa-form-group">
              <label className="sa-label">Stock Quantity *</label>
              <input className={inputCls} type="number" min="0" value={formData.quantity} onChange={e => set('quantity', e.target.value)} required />
            </div>
          </SectionCard>

          <SectionCard title="Organization" icon={Settings}>
            <div className="sa-form-group">
              <label className="sa-label">Status</label>
              <select className={inputCls} value={formData.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="sa-form-group">
              <label className="sa-label">Category</label>
              <select className={inputCls} value={formData.categoryId} onChange={e => set('categoryId', e.target.value)}>
                <option value="">— No Category —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </SectionCard>

          <SectionCard title="Merchandising Flags" icon={BarChart3}>
            <p className="sa-text-muted" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 12 }}>
              Control which homepage sections this product appears in.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { key: 'featured', label: 'Featured Product', desc: 'Shows in Featured section on homepage' },
                { key: 'trending', label: 'Trending', desc: 'Shows in Trending Now section' },
                { key: 'flashSale', label: '⚡ Flash Sale', desc: 'Shows in Flash Sale with countdown timer' },
                { key: 'bestSeller', label: '🏆 Best Seller', desc: 'Shows in Best Sellers section' },
              ].map(({ key, label, desc }) => (
                <label key={key} style={{ display: 'flex', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!formData[key]}
                    onChange={e => set(key, e.target.checked)}
                    style={{ marginTop: 2, flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{label}</div>
                    <div className="sa-text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </SectionCard>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="sa-btn sa-btn-ghost"
              style={{ flex: 1 }}
              onClick={() => navigate('/ecommerce/products')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="sa-btn sa-btn-primary"
              style={{ flex: 2 }}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? <span className="sa-spinner-sm sa-spinner" /> : <Save size={16} />}
              {isEditing ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
