"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu, X, Search, ChevronDown, Grid3X3, Zap, TrendingUp,
  Star, Tag, Sparkles, Store, Heart, Scale, User, Bell, Globe2,
  MapPin, Truck, Headphones, MessageCircle, Moon, Sun, Languages
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CartIcon from "@/components/cart/CartIcon";
import { debounce } from "@/lib/utils";
import type { ProductCategory } from "@/types";

// ─── Search Bar ────────────────────────────────────────────────
interface SearchResult {
  id: string;
  name: string;
  slug: string;
  category?: string;
  price?: number;
  currency?: string;
}

function SearchBar({ onClose }: { onClose?: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Use useMemo to persist the debounced function across renders without exhaustive-deps warning
  const doSearch = useMemo(
    () => debounce(async (q: string) => {
      if (q.length < 2) { setResults([]); return; }
      setLoading(true);
      try {
        const res = await fetch(`/api/public/products/search?q=${encodeURIComponent(q)}&limit=6`);
        const data = await res.json();
        setResults(data.data ?? []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300),
    []
  );

  useEffect(() => { doSearch(query); }, [query, doSearch]);

  const showDropdown = focused && (results.length > 0 || (query.length >= 2 && !loading));

  return (
    <div className="relative flex-1 max-w-xl">
      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-4 py-2 focus-within:border-secondary focus-within:ring-2 focus-within:ring-secondary/20 transition-all">
        <Search size={16} className="text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholder="Search products…"
          className="bg-transparent flex-1 text-sm text-slate-800 placeholder-slate-400 outline-none"
          aria-label="Search products"
          id="navbar-search-input"
        />
        {query && (
          <button onClick={() => setQuery("")} className="text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="search-suggestions"
          >
            {results.length === 0 ? (
              <div className="p-4 text-sm text-slate-500 text-center">
                No results for &ldquo;{query}&rdquo;
              </div>
            ) : (
              <div>
                {results.map((r) => (
                  <Link
                    key={r.id}
                    href={`/products/${r.slug}`}
                    onClick={() => { setQuery(""); onClose?.(); }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <Search size={14} className="text-slate-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{r.name}</p>
                      {r.category && (
                        <p className="text-xs text-slate-400">{r.category}</p>
                      )}
                    </div>
                  </Link>
                ))}
                <Link
                  href={`/products?search=${encodeURIComponent(query)}`}
                  onClick={() => { setQuery(""); onClose?.(); }}
                  className="flex items-center gap-2 px-4 py-3 border-t border-slate-100 text-sm text-primary font-medium hover:bg-slate-50 transition-colors"
                >
                  <Search size={14} />
                  See all results for &ldquo;{query}&rdquo;
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Categories Dropdown ───────────────────────────────────────
function CategoriesDropdown({ categories }: { categories: ProductCategory[] }) {
  const [open, setOpen] = useState(false);
  const icons = [Grid3X3, Zap, Star, Tag, TrendingUp, Sparkles];

  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        className="flex items-center gap-1.5 text-slate-700 hover:text-primary font-medium text-sm transition-colors py-2"
        aria-haspopup="true"
        aria-expanded={open}
        id="categories-dropdown-btn"
      >
        <Store size={16} />
        Shop
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-2 bg-white rounded-2xl shadow-premium border border-slate-100 min-w-[240px] z-50 overflow-hidden py-2"
          >
            <Link
              href="/products"
              className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-sm font-semibold text-primary border-b border-slate-100 mb-1"
            >
              <Grid3X3 size={16} className="text-primary" />
              All Products
            </Link>
            {categories.slice(0, 8).map((cat, i) => {
              const Icon = icons[i % icons.length];
              return (
                <Link
                  key={cat.id}
                  href={`/products?category=${cat.slug}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-sm text-slate-700 hover:text-primary"
                >
                  <div className="flex items-center gap-3">
                    <Icon size={15} className="text-slate-400" />
                    {cat.name}
                  </div>
                  {cat._count && (
                    <span className="text-xs text-slate-400 font-medium">
                      {cat._count.products}
                    </span>
                  )}
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Navbar ───────────────────────────────────────────────
export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    fetch("/api/public/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.data ?? []))
      .catch(() => { });
  }, []);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("hq-store-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDarkMode(savedTheme ? savedTheme === "dark" : prefersDark);
  }, []);

  useEffect(() => {
    const theme = darkMode ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("hq-store-theme", theme);
  }, [darkMode]);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const billingUrl = process.env.NEXT_PUBLIC_BILLING_SYSTEM_URL ?? "/billing";
  const utilityLinks = [
    { href: "/track-order", label: "Track Order", icon: Truck },
    { href: "/support", label: "Support", icon: Headphones },
    { href: "/support", label: "Contact", icon: MessageCircle },
  ];

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled
        ? "bg-white/90 backdrop-blur-lg shadow-md border-b border-slate-100"
        : "bg-white/80 backdrop-blur-sm"
        }`}
    >
      <div className="hidden md:block bg-slate-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-9 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Zap size={13} className="text-amber-300 shrink-0" />
            <span className="font-semibold truncate">
              Free shipping on selected Dar es Salaam orders - Flash sale ends in 02:18:44
            </span>
          </div>
          <div className="flex items-center gap-5 shrink-0">
            <span className="inline-flex items-center gap-1.5 text-white/75">
              <MapPin size={13} /> Store location
            </span>
            {utilityLinks.map(({ href, label, icon: Icon }) => (
              <Link key={label} href={href} className="inline-flex items-center gap-1.5 text-white/75 hover:text-white">
                <Icon size={13} />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 gap-4">
          {/* Logo */}
          <Link href="/" className="shrink-0 flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0"
              style={{ background: "var(--gradient-primary)" }}
            >
              HQ
            </div>
            <span className="font-display font-bold text-primary text-sm sm:text-base leading-tight hidden sm:block">
              HQ <span className="text-secondary">INVESTMENT</span>
            </span>
          </Link>

          {/* Desktop Search */}
          <div className="hidden lg:flex flex-1 justify-center px-6">
            <SearchBar />
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-5 shrink-0">
            <CategoriesDropdown categories={categories} />
            <Link href="/products?collection=deals" className="text-sm text-slate-600 hover:text-primary font-medium transition-colors">
              Deals
            </Link>
            <Link href="/recently-viewed" className="text-sm text-slate-600 hover:text-primary font-medium transition-colors">
              Recent
            </Link>
            <Link href="/#features" className="text-sm text-slate-600 hover:text-primary font-medium transition-colors">
              Features
            </Link>
            <Link href="/#pricing" className="text-sm text-slate-600 hover:text-primary font-medium transition-colors">
              Pricing
            </Link>
            <Link href="/#contact" className="text-sm text-slate-600 hover:text-primary font-medium transition-colors">
              Contact
            </Link>
            <a href={`${billingUrl}billing/login`} className="text-sm text-slate-600 hover:text-primary font-medium transition-colors border-l border-slate-200 pl-5">
              Login
            </a>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 ml-auto md:ml-0 shrink-0">
            <div className="hidden xl:flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
              <button className="p-1.5 rounded-full hover:bg-white text-slate-500" aria-label="Change language">
                <Languages size={15} />
              </button>
              <span className="text-xs font-bold text-slate-500">EN</span>
              <span className="h-4 w-px bg-slate-200" />
              <button className="p-1.5 rounded-full hover:bg-white text-slate-500" aria-label="Change currency">
                <Globe2 size={15} />
              </button>
              <span className="text-xs font-bold text-slate-500">TZS</span>
            </div>
            <button
              onClick={() => setDarkMode((value) => !value)}
              className="hidden lg:flex w-9 h-9 rounded-full border border-slate-200 bg-white text-slate-500 items-center justify-center hover:text-primary hover:border-primary/30 transition-all"
              aria-label={darkMode ? "Switch to light theme" : "Switch to dark theme"}
              title={darkMode ? "Light theme" : "Dark theme"}
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {[
              { href: "/wishlist", label: "Wishlist", icon: Heart },
              { href: "/compare", label: "Compare products", icon: Scale },
              { href: `${billingUrl}billing/login`, label: "Customer account", icon: User },
              { href: "/notifications", label: "Notifications", icon: Bell },
            ].map(({ href, label, icon: Icon }) => {
              const isExternal = href.startsWith('http') || href.startsWith(billingUrl);
              const linkClasses = "hidden lg:flex w-9 h-9 rounded-full border border-slate-200 bg-white text-slate-500 items-center justify-center hover:text-primary hover:border-primary/30 transition-all";

              if (isExternal) {
                return (
                  <a key={label} href={href} className={linkClasses} aria-label={label} title={label}>
                    <Icon size={18} strokeWidth={2} />
                  </a>
                );
              }

              return (
                <Link
                  key={label}
                  href={href}
                  className={linkClasses}
                  aria-label={label}
                  title={label}
                >
                  <Icon size={18} strokeWidth={2} />
                </Link>
              );
            })}
            <CartIcon />
            <div className="hidden md:block">
              <Link
                href="/#pricing"
                className="px-5 py-2 text-sm font-bold text-white rounded-full transition-all hover:opacity-90 hover:-translate-y-0.5"
                style={{ background: "var(--gradient-primary)" }}
              >
                Get Started
              </Link>
            </div>
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-full hover:bg-slate-100 transition-all text-slate-600"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Search bar */}
        <div className="lg:hidden pb-3 -mt-1 block">
          <SearchBar onClose={() => setMobileOpen(false)} />
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden overflow-hidden bg-white border-t border-slate-100 shadow-lg"
          >
            <div className="px-4 py-4 space-y-1 max-h-[70vh] overflow-y-auto">
              <Link href="/products" className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 text-slate-700 font-medium">
                <Store size={18} className="text-primary" />
                All Products
              </Link>
              {[
                { href: "/wishlist", label: "Wishlist" },
                { href: "/compare", label: "Compare Products" },
                { href: "/recently-viewed", label: "Recently Viewed" },
                { href: "/track-order", label: "Order Tracking" },
                { href: "/support", label: "Help Center" },
              ].map((item) => (
                <Link key={item.label} href={item.href} className="block px-3 py-2.5 rounded-xl hover:bg-slate-50 text-sm text-slate-700">
                  {item.label}
                </Link>
              ))}
              {categories.slice(0, 6).map((cat) => (
                <Link key={cat.id} href={`/products?category=${cat.slug}`}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-50 text-sm text-slate-600">
                  <span>{cat.name}</span>
                  {cat._count && <span className="text-xs text-slate-400">{cat._count.products}</span>}
                </Link>
              ))}
              <div className="pt-2 border-t border-slate-100 space-y-1">
                <Link href="/#features" className="block px-3 py-2.5 rounded-xl hover:bg-slate-50 text-sm text-slate-700">Features</Link>
                <Link href="/#pricing" className="block px-3 py-2.5 rounded-xl hover:bg-slate-50 text-sm text-slate-700">Pricing</Link>
                <Link href="/#contact" className="block px-3 py-2.5 rounded-xl hover:bg-slate-50 text-sm text-slate-700">Contact</Link>
                <a href={`${billingUrl}billing/login`} className="block px-3 py-2.5 rounded-xl hover:bg-slate-50 text-sm text-slate-700 font-medium">Login</a>
              </div>
              <Link
                href="/#pricing"
                className="block w-full text-center py-3 rounded-full text-sm font-bold text-white mt-3"
                style={{ background: "var(--gradient-primary)" }}
              >
                Get Started Free
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
