"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, MapPin, Send } from "lucide-react";
import { getErrorMessage } from "@/lib/utils";

export default function Contact() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("Something went wrong. Please try again or email us directly at support@hqinvestment.co.tz");

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
        setErrorMessage(data.error || "Something went wrong. Please try again or email us directly at support@hqinvestment.co.tz");
        setStatus("error");
        return;
      }

      setStatus("success");
      setFormData({ name: "", email: "", message: "" });
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, "Network error. Please try again or email us directly at support@hqinvestment.co.tz"));
      setStatus("error");
    }
  };

  return (
    <section id="contact" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-14 lg:gap-20 items-center">
          <div>
            <h2 className="text-3xl md:text-5xl font-bold text-primary mb-6">
              Let&apos;s Find the Right Plan for Your Network
            </h2>
            <p className="text-lg text-gray-600 mb-10 leading-relaxed">
              Have questions? Need a custom quote? Our team of ISP billing experts typically
              responds within a few hours, not days.
            </p>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 text-primary rounded-full">
                  <Mail className="h-6 w-6" />
                </div>
                <span className="text-lg text-gray-700">support@hqinvestment.co.tz</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 text-primary rounded-full">
                  <MapPin className="h-6 w-6" />
                </div>
                <span className="text-lg text-gray-700">Dar es Salaam, Tanzania</span>
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="p-6 md:p-10 rounded-3xl bg-softBg shadow-xl"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-gray-700 font-medium mb-2" htmlFor="contact-name">
                  Your Name
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                  placeholder="Your full name"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2" htmlFor="contact-email">
                  Work Email
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                  placeholder="you@yourcompany.com"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2" htmlFor="contact-message">
                  How Can We Help?
                </label>
                <textarea
                  id="contact-message"
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(event) => setFormData({ ...formData, message: event.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                  placeholder="Tell us about your network size, current challenges, or which plan interests you."
                />
              </div>
              <button
                type="submit"
                disabled={status === "loading"}
                className={`w-full py-4 rounded-xl text-lg font-bold text-white transition-all ${
                  status === "loading" ? "bg-gray-400" : "bg-primary hover:bg-accent"
                }`}
              >
                {status === "loading" ? (
                  "Sending..."
                ) : (
                  <span className="inline-flex items-center justify-center gap-2">
                    Send Message <Send size={18} />
                  </span>
                )}
              </button>
              {status === "success" && (
                <p className="text-green-600 font-medium text-center">
                  Message received! We&apos;ll get back to you within a few hours.
                </p>
              )}
              {status === "error" && (
                <p className="text-red-600 font-medium text-center">
                  {errorMessage}
                </p>
              )}
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
