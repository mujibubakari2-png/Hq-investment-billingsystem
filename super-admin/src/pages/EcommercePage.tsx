import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ClipboardList, Search, Settings, Shield, ShoppingBag, Star } from 'lucide-react';
import {
  commerceModules,
  commerceReadinessItems,
  commerceStatusClass,
  matchesCommerceModule,
} from '../config/ecommerceModules';

export default function EcommercePage() {
  const navigate = useNavigate();
  const { module } = useParams();
  const [query, setQuery] = useState('');
  const activeModule = useMemo(
    () => commerceModules.find((item) => item.slug === module) ?? null,
    [module],
  );
  const filteredModules = useMemo(
    () => commerceModules.filter((item) => matchesCommerceModule(item, query)),
    [query],
  );
  const operationalCount = commerceModules.filter((item) => item.status === 'Operational').length;
  const integrationCount = commerceModules.filter((item) => item.status === 'Integration Required').length;
  const configuredCount = commerceModules.filter((item) => item.status === 'Configured').length;

  return (
    <div>
      <div className="sa-page-header">
        <div className="sa-page-header-left">
          <h1>E-Commerce <span className="sa-gradient-text">Command Center</span></h1>
          <p>Manage catalogue, campaigns, orders, checkout, content, and developer access from one module.</p>
        </div>
        <button
          className="sa-btn sa-btn-primary"
          onClick={() => navigate('/ecommerce/products')}
          type="button"
        >
          <ShoppingBag size={15} /> Manage Products
        </button>
      </div>

      <div className="sa-stats-grid">
        <div className="sa-stat-card">
          <div className="sa-stat-header">
            <span className="sa-stat-label">Commerce Modules</span>
            <div className="sa-stat-icon primary"><ShoppingBag size={18} /></div>
          </div>
          <div className="sa-stat-value">{commerceModules.length}</div>
          <div className="sa-stat-footer"><span className="sa-stat-sub">Full admin coverage</span></div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-header">
            <span className="sa-stat-label">Operational Areas</span>
            <div className="sa-stat-icon success"><Shield size={18} /></div>
          </div>
          <div className="sa-stat-value">{operationalCount}</div>
          <div className="sa-stat-footer"><span className="sa-stat-sub">Connected to storefront workflows</span></div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-header">
            <span className="sa-stat-label">Integration Queue</span>
            <div className="sa-stat-icon warning"><Settings size={18} /></div>
          </div>
          <div className="sa-stat-value">{integrationCount}</div>
          <div className="sa-stat-footer"><span className="sa-stat-sub">Provider and configuration work</span></div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-header">
            <span className="sa-stat-label">Configured Areas</span>
            <div className="sa-stat-icon info"><ClipboardList size={18} /></div>
          </div>
          <div className="sa-stat-value">{configuredCount}</div>
          <div className="sa-stat-footer"><span className="sa-stat-sub">Ready for data and provider rollout</span></div>
        </div>
        <div className="sa-stat-card">
          <div className="sa-stat-header">
            <span className="sa-stat-label">Customer Experience</span>
            <div className="sa-stat-icon accent"><Star size={18} /></div>
          </div>
          <div className="sa-stat-value">Premium</div>
          <div className="sa-stat-footer"><span className="sa-stat-sub">Landing page configurable</span></div>
        </div>
      </div>

      {activeModule && (
        <div className="sa-card sa-mb-24">
          <div className="sa-ecom-detail">
            <div className="sa-ecom-detail-icon">{activeModule.icon}</div>
            <div>
              <div className="sa-card-title">Selected Module</div>
              <h2>{activeModule.label}</h2>
              <p>{activeModule.description}</p>
              <div className="sa-ecom-meta-row">
                <span>Owner: {activeModule.owner}</span>
                <span>{activeModule.metric}</span>
              </div>
            </div>
            <span className={`sa-ecom-status ${commerceStatusClass[activeModule.status]}`}>
              {activeModule.status}
            </span>
          </div>
          <div className="sa-ecom-action-row">
            {activeModule.actions.map((action) => {
              // Determine the target route for this module
              const specialRoutes: Record<string, string> = {
                banners: '/cms/banners',
                blog: '/cms/blogs',
                pages: '/cms/pages',
                cms: '/cms/storefront-settings',
              };
              const target = specialRoutes[activeModule.slug] ?? `/ecommerce/${activeModule.slug}`;

              return (
                <button
                  key={action}
                  className="sa-ecom-action-chip"
                  type="button"
                  onClick={() => navigate(target)}
                  aria-label={`${action} — navigate to ${activeModule.label}`}
                >
                  {action} <ArrowRight size={13} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="sa-card sa-mb-24">
        <div className="sa-card-header">
          <span className="sa-card-title">Production Readiness</span>
          <span className="sa-ecom-note">No duplicated commerce modules; each area has one owner and one navigation entry.</span>
        </div>
        <div className="sa-ecom-readiness-grid">
          {commerceReadinessItems.map((item) => (
            <div key={item.label} className="sa-ecom-readiness-card">
              <div className="sa-ecom-readiness-top">
                <CheckCircle2 size={17} />
                <span className={`sa-ecom-status ${commerceStatusClass[item.status]}`}>{item.status}</span>
              </div>
              <h3>{item.label}</h3>
              <p>{item.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="sa-card sa-mb-24">
        <div className="sa-card-header">
          <span className="sa-card-title">Module Map</span>
          <div className="sa-search-bar">
            <Search className="sa-search-icon" size={15} />
            <input
              className="sa-input"
              aria-label="Search commerce modules"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
        <div className="sa-ecom-module-grid">
          {filteredModules.map((item) => (
            <button
              key={item.slug}
              className={`sa-ecom-module ${item.slug === module ? 'active' : ''}`}
              onClick={() => navigate(`/ecommerce/${item.slug}`)}
              type="button"
            >
              <span className="sa-ecom-module-icon">{item.icon}</span>
              <span className="sa-ecom-module-body">
                <span className="sa-ecom-module-title">{item.label}</span>
                <span className="sa-ecom-module-text">{item.description}</span>
                <span className="sa-ecom-module-footer">
                  <span>{item.owner} / {item.metric}</span>
                  <span className={`sa-ecom-status ${commerceStatusClass[item.status]}`}>{item.status}</span>
                </span>
                <span className="sa-ecom-module-actions">
                  {item.actions.slice(0, 2).map((action) => <span key={action}>{action}</span>)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="sa-grid-3">
        <div className="sa-card">
          <span className="sa-card-title">Landing Page Control</span>
          <p className="sa-ecom-note">Banners, collections, featured products, flash deals, testimonials, and FAQs are represented as commerce-controlled areas.</p>
        </div>
        <div className="sa-card">
          <span className="sa-card-title">Checkout Readiness</span>
          <p className="sa-ecom-note">Payments, shipping, taxes, coupons, order tracking, refunds, and customer notifications are grouped for integrations.</p>
        </div>
        <div className="sa-card">
          <span className="sa-card-title">Developer</span>
          <p className="sa-ecom-note">API keys and webhook settings sit inside the commerce module so integrations stay isolated from existing platform settings.</p>
        </div>
      </div>
    </div>
  );
}
