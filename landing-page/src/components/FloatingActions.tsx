"use client";

import { useEffect, useState } from "react";
import { ArrowUp, MessageCircle } from "lucide-react";

export default function FloatingActions() {
  const [mounted, setMounted] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "255621085215";

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => setShowScrollTop(window.scrollY > 400);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleWhatsAppClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const text = encodeURIComponent("Habari, nahitaji msaada.");
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
      window.location.href = `whatsapp://send?phone=${whatsappNumber}&text=${text}`;
    } else {
      window.open(`https://web.whatsapp.com/send?phone=${whatsappNumber}&text=${text}`, "_blank");
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!mounted) {
    return null;
  }

  return (
    <div
      className="fixed bottom-6 right-5 z-50 flex flex-col items-center gap-3"
      aria-label="Floating action buttons"
    >
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-lg hover:-translate-y-0.5 transition-transform"
          style={{ background: "var(--gradient-primary)" }}
          aria-label="Scroll to top"
          title="Back to top"
        >
          <ArrowUp size={18} />
        </button>
      )}

      <a
        href="#"
        onClick={handleWhatsAppClick}
        className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-xl hover:-translate-y-1 transition-transform"
        style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
        aria-label="Chat on WhatsApp"
        title="Chat with us on WhatsApp"
      >
        <MessageCircle size={26} className="text-white" />
        <span className="absolute inset-0 rounded-full animate-ping opacity-25" style={{ background: "#25D366" }} />
      </a>
    </div>
  );
}
