"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Headphones, Mail, MessageSquare, FileText, ChevronDown, ChevronUp, Send, CheckCircle, AlertCircle } from "lucide-react";

const faqs = [
  {
    question: "How can I track my order?",
    answer: "You can track your order using the 'Track Order' link in the footer or by logging into your account and visiting the Orders section."
  },
  {
    question: "What is your return policy?",
    answer: "We offer a 7-day return policy for most items. The product must be unused and in its original packaging. Please contact support to initiate a return."
  },
  {
    question: "How long does delivery take?",
    answer: "For deliveries within Dar es Salaam, we typically offer same-day or next-day delivery. For other regions, it takes between 2-5 business days."
  },
  {
    question: "Do you offer warranties on electronics?",
    answer: "Yes, most of our electronics come with a standard 1-year manufacturer warranty. Please check the specific product page for details."
  },
  {
    question: "What payment methods are accepted?",
    answer: "We accept mobile money (M-Pesa, Tigo Pesa, Airtel Money), credit/debit cards, and cash on delivery for selected areas."
  }
];

export default function SupportPage() {
  const [mounted, setMounted] = useState(false);
  
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);
    
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setSubmitStatus({ type: 'success', text: "Message sent successfully! We'll get back to you soon." });
        setFormData({ name: "", email: "", message: "" });
      } else {
        setSubmitStatus({ type: 'error', text: data.error || "Failed to send message. Please try again." });
      }
    } catch (err) {
      setSubmitStatus({ type: 'error', text: "A network error occurred. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen pt-32 pb-20 bg-softBg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-2 rounded-full glass text-sm font-semibold text-primary mb-4">
            Support Center
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-primary mb-4">
            How can we help you today?
          </h1>
          <p className="text-lg text-secondary max-w-2xl mx-auto">
            Find answers to common questions or get in touch with our support team directly.
          </p>
        </div>

        {/* Quick Contact Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          <a href="mailto:support@hqinvestment.com" className="glass-card rounded-2xl p-8 flex items-start gap-4 hover:-translate-y-1 transition-transform cursor-pointer">
            <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Mail size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-primary mb-1">Email Support</h3>
              <p className="text-secondary mb-3">Send us an email anytime, and we&apos;ll respond within 24 hours.</p>
              <span className="text-blue-600 font-semibold">support@hqinvestment.com</span>
            </div>
          </a>
          
          <a href="https://wa.me/255123456789" target="_blank" rel="noopener noreferrer" className="glass-card rounded-2xl p-8 flex items-start gap-4 hover:-translate-y-1 transition-transform cursor-pointer">
            <div className="w-14 h-14 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0">
              <MessageSquare size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-primary mb-1">Live Chat (WhatsApp)</h3>
              <p className="text-secondary mb-3">Chat with our customer service team for immediate assistance.</p>
              <span className="text-green-600 font-semibold">+255 123 456 789</span>
            </div>
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* FAQ Section */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <FileText size={20} />
              </div>
              <h2 className="text-2xl font-bold text-primary">Frequently Asked Questions</h2>
            </div>
            
            <div className="space-y-4">
              {faqs.map((faq, idx) => (
                <div 
                  key={idx} 
                  className={`glass-card rounded-2xl overflow-hidden transition-all duration-300 ${activeFaq === idx ? 'ring-2 ring-blue-500/20' : ''}`}
                >
                  <button
                    onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none"
                  >
                    <span className="font-semibold text-primary pr-8">{faq.question}</span>
                    <span className={`text-secondary transition-transform duration-300 ${activeFaq === idx ? 'rotate-180' : ''}`}>
                      <ChevronDown size={20} />
                    </span>
                  </button>
                  <div 
                    className={`px-6 overflow-hidden transition-all duration-300 ${activeFaq === idx ? 'max-h-48 pb-5 opacity-100' : 'max-h-0 opacity-0'}`}
                  >
                    <p className="text-secondary leading-relaxed">{faq.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contact Form */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Headphones size={20} />
              </div>
              <h2 className="text-2xl font-bold text-primary">Send us a Message</h2>
            </div>

            <div className="glass-card rounded-2xl p-8">
              <form onSubmit={handleContactSubmit} className="space-y-6">
                
                {submitStatus && (
                  <div className={`p-4 rounded-xl flex items-start gap-3 ${submitStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {submitStatus.type === 'success' ? <CheckCircle size={20} className="shrink-0 mt-0.5" /> : <AlertCircle size={20} className="shrink-0 mt-0.5" />}
                    <p className="text-sm font-medium">{submitStatus.text}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-semibold text-primary">Your Name</label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="John Doe"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-semibold text-primary">Email Address</label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="john@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="message" className="text-sm font-semibold text-primary">Message</label>
                  <textarea
                    id="message"
                    required
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                    placeholder="How can we help you?"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  {isSubmitting ? "Sending..." : (
                    <>
                      Send Message
                      <Send size={18} />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
