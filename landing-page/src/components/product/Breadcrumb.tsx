import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm flex-wrap">
      <Link href="/" className="text-slate-400 hover:text-primary transition-colors flex items-center gap-1">
        <Home size={14} />
        <span className="sr-only">Home</span>
      </Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <ChevronRight size={14} className="text-slate-300" />
          {item.href && i < items.length - 1 ? (
            <Link href={item.href} className="text-slate-500 hover:text-primary transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-800 font-semibold truncate max-w-[200px]" aria-current="page">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
