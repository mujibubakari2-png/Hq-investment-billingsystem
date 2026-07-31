import Link from "next/link";
import { ClipboardCheck, Mail, PackageSearch, ShieldCheck, Truck } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const trackingSteps = [
  { title: "Order received", text: "We confirm payment and reserve stock for the customer.", icon: ClipboardCheck },
  { title: "Packed and dispatched", text: "The fulfilment team prepares the package and assigns delivery.", icon: PackageSearch },
  { title: "On the way", text: "Courier, pickup point, or internal delivery updates become visible.", icon: Truck },
  { title: "Delivered securely", text: "Completion, warranty, and support records stay audit-ready.", icon: ShieldCheck },
];

export const metadata = {
  title: "Track Order",
  description: "Track HQ Investment marketplace orders and get delivery support.",
};

export default function TrackOrderPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />
      <section className="pt-36 pb-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 md:p-10 text-white" style={{ background: "linear-gradient(135deg, #020617, #1d4ed8 55%, #0f766e)" }}>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-xs font-black uppercase tracking-widest">
                <Truck size={14} /> Order tracking
              </span>
              <h1 className="font-display text-3xl md:text-5xl font-black mt-5">Track your order</h1>
              <p className="text-white/70 mt-4 max-w-2xl">
                Enter your order number and contact details through support while live carrier
                integrations are connected. The flow is ready for automated tracking updates.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-8 p-6 md:p-10">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <h2 className="font-display text-2xl font-black text-slate-950">Request status update</h2>
                <p className="text-sm text-slate-500 mt-2">
                  Send your order number to support and the team will confirm payment, delivery,
                  pickup, or warranty status.
                </p>
                <div className="mt-6 space-y-3">
                  <Link
                    href="/#contact"
                    className="flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white"
                    style={{ background: "var(--gradient-primary)" }}
                  >
                    <Mail size={16} /> Contact support
                  </Link>
                  <Link
                    href="/products"
                    className="flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:border-primary hover:text-primary"
                  >
                    Continue shopping
                  </Link>
                </div>
              </div>

              <div className="space-y-4">
                {trackingSteps.map(({ icon: Icon, ...step }, index) => (
                  <div key={step.title} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 text-primary flex items-center justify-center shrink-0">
                      <Icon size={20} />
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-slate-400">Step {index + 1}</div>
                      <h3 className="font-bold text-slate-950 mt-1">{step.title}</h3>
                      <p className="text-sm text-slate-500 mt-1">{step.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
