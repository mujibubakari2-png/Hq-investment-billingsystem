import "./PaymentCheckout.css";

export interface ProviderOption {
  id: string;
  label: string;
  logo: string;
  description: string;
  color: string;
}

const PROVIDERS: ProviderOption[] = [
  {
    id: "PALMPESA",
    label: "PalmPesa",
    logo: "🌴",
    description: "M-Pesa, Airtel, Tigo, Halo, TTCL",
    color: "#10b981",
  },
  {
    id: "ZENOPAY",
    label: "ZenoPay",
    logo: "⚡",
    description: "All TZ mobile networks",
    color: "#6366f1",
  },
  {
    id: "MONGIKE",
    label: "Mongike",
    logo: "🔗",
    description: "M-Pesa, Airtel, Halo, Tigo",
    color: "#f59e0b",
  },
  {
    id: "HARAKAPAY",
    label: "HarakaPay",
    logo: "🚀",
    description: "Fast mobile money collection",
    color: "#ef4444",
  },
];

interface ProviderSelectorProps {
  value: string;
  onChange: (provider: string) => void;
}

export default function ProviderSelector({ value, onChange }: ProviderSelectorProps) {
  return (
    <div className="provider-grid" role="radiogroup" aria-label="Payment method">
      {PROVIDERS.map((p) => {
        const selected = value === p.id;
        return (
          <button
            key={p.id}
            type="button"
            id={`provider-${p.id.toLowerCase()}`}
            role="radio"
            aria-checked={selected}
            className={`provider-card${selected ? " provider-card-selected" : ""}`}
            style={selected ? { borderColor: p.color, boxShadow: `0 0 0 3px ${p.color}22` } : {}}
            onClick={() => onChange(p.id)}
          >
            <span className="provider-logo">{p.logo}</span>
            <span className="provider-name">{p.label}</span>
            <span className="provider-desc">{p.description}</span>
            {selected && (
              <span
                className="provider-check"
                style={{ background: p.color }}
              >
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
