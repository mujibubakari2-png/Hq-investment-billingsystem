"use client";
import { useState } from "react";
import { motion } from "framer-motion";

export default function Contact() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setStatus("success");
        setFormData({ name: "", email: "", message: "" });
      } else {
        setStatus("error");
      }
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
  };

  return (
    <section id="contact" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div>
            <h2 className="text-3xl md:text-5xl font-bold text-primary mb-6">Let's Find the Right Plan for Your Network</h2>
            <p className="text-lg text-gray-600 mb-10 leading-relaxed">
              Have questions? Need a custom quote? Our team of ISP billing experts typically responds within a few hours — not days.
            </p>
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-100 text-primary rounded-full">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                </div>
                <span className="text-lg text-gray-700">support@hqinvestment.co.tz</span>
              </div>
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-100 text-primary rounded-full">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
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
            className="p-10 rounded-3xl bg-softBg shadow-xl"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-gray-700 font-medium mb-2">Your Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                  placeholder="John Mwangi"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">Work Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                  placeholder="you@yourcompany.com"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">How Can We Help?</label>
                <textarea
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
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
                {status === "loading" ? "Sending..." : "Send Message →"}
              </button>
              {status === "success" && <p className="text-green-600 font-medium text-center">Message received! We'll get back to you within a few hours.</p>}
              {status === "error" && <p className="text-red-600 font-medium text-center">Something went wrong. Please try again or email us directly at support@hqinvestment.co.tz</p>}
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
