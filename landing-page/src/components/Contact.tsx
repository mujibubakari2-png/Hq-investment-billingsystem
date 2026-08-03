"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, MapPin, Phone, Send, MessageCircle, Clock } from "lucide-react";
import { getErrorMessage } from "@/lib/utils";

const CONTACT_INFO = [
  {
    icon: Mail,
    label: "Email us",
    value: "support@hqinvestment.co.tz",
    href: "mailto:support@hqinvestment.co.tz",
  },
  {
    icon: Phone,
    label: "Call us",
    value: "+255 621 085 215",
    href: "tel:+255621085215",
  },
  {
    icon: MessageCircle,
    label: "WhatsApp",
    value: "Chat with us",
    href: "https://wa.me/255621085215",
  },
  {
    icon: MapPin,
    label: "Location",
    value: "Dar es Salaam, Tanzania",
    href: undefined,
  },
];

export default function Contact() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState(
    "Something went wrong. Please try again or email us directly."
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("loading");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      if (!response.ok || data.success === false) {
        setErrorMessage(
          data.error ?? "Something went wrong. Please email us directly at support@hqinvestment.co.tz"
        );
        setStatus("error");
        return;
      }

      setStatus("success");
      setFormData({ name: "", email: "", message: "" });
    } catch (error: unknown) {
      setErrorMessage(
        getErrorMessage(error, "Network error. Please try again or email us directly.")
      );
      setStatus("error");
    }
  };

  const field =
    "w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all";

  return (
    <section id="contact" className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
          {/* Left: Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-primary bg-primary/8 px-4 py-2 rounded-full mb-5">
              Contact Us
            </span>
            <h2 className="section-title font-display mb-4">
              Let&apos;s Find the Right Plan for Your Network
            </h2>
            <p className="text-slate-500 leading-relaxed mb-10 max-w-md">
              Have questions about our ISP billing platform or marketplace?
              Our team typically responds within a few hours — not days.
            </p>

            <ul className="space-y-5">
              {CONTACT_INFO.map(({ icon: Icon, label, value, href }) => (
                <li key={label}>
                  {href ? (
                    <a
                      href={href}
                      target={href.startsWith("http") ? "_blank" : undefined}
                      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                      onClick={(e) => {
                        if (href.includes("wa.me") || href.includes("whatsapp")) {
                          e.preventDefault();
                          const text = encodeURIComponent("Habari, nahitaji msaada.");
                          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                          if (isMobile) {
                            window.location.href = `whatsapp://send?phone=255621085215&text=${text}`;
                          } else {
                            window.open(`https://web.whatsapp.com/send?phone=255621085215&text=${text}`, "_blank");
                          }
                        }
                      }}
                      className="flex items-center gap-4 group"
                    >
                      <div className="w-11 h-11 rounded-2xl bg-primary/8 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                        <Icon size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                          {label}
                        </p>
                        <p className="text-slate-800 font-semibold text-sm group-hover:text-primary transition-colors">
                          {value}
                        </p>
                      </div>
                    </a>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-2xl bg-primary/8 text-primary flex items-center justify-center shrink-0">
                        <Icon size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                          {label}
                        </p>
                        <p className="text-slate-800 font-semibold text-sm">{value}</p>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {/* Response time indicator */}
            <div className="mt-10 flex items-center gap-3 px-5 py-4 rounded-2xl bg-emerald-50 border border-emerald-100">
              <Clock size={18} className="text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-800">Average response time</p>
                <p className="text-xs text-emerald-600">Under 2 hours during business hours</p>
              </div>
            </div>
          </motion.div>

          {/* Right: Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 md:p-10"
          >
            <h3 className="font-display font-bold text-xl text-slate-900 mb-6">
              Send us a message
            </h3>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="contact-name" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Your Name
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={field}
                  placeholder="Your full name"
                />
              </div>

              <div>
                <label htmlFor="contact-email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Work Email
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={field}
                  placeholder="you@yourcompany.com"
                />
              </div>

              <div>
                <label htmlFor="contact-message" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  How Can We Help?
                </label>
                <textarea
                  id="contact-message"
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className={field}
                  placeholder="Tell us about your network size, current challenges, or which plan interests you."
                />
              </div>

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-base font-bold text-white transition-all hover:-translate-y-0.5 hover:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
                style={{ background: "var(--gradient-primary)" }}
              >
                {status === "loading" ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    Send Message
                    <Send size={16} />
                  </>
                )}
              </button>

              {status === "success" && (
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-emerald-600 font-semibold text-sm text-center bg-emerald-50 rounded-xl py-3"
                >
                  ✓ Message received! We&apos;ll get back to you within a few hours.
                </motion.p>
              )}
              {status === "error" && (
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-rose-600 font-semibold text-sm text-center bg-rose-50 rounded-xl py-3 px-4"
                >
                  {errorMessage}
                </motion.p>
              )}
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
