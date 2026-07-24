/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Original brand colors (kept for backward compat)
        primary: "#1e3a8a",
        secondary: "#3b82f6",
        accent: "#1d4ed8",
        softBg: "#f8fafc",
        // Extended palette
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e3a8a",
          900: "#1e3a8a",
        },
        emerald: {
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
        },
        rose: {
          400: "#fb7185",
          500: "#f43f5e",
          600: "#e11d48",
        },
        amber: {
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        display: ["Plus Jakarta Sans", "sans-serif"],
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "float-delay": "float-delay 8s ease-in-out infinite",
        "gradient-shift": "gradient-shift 6s ease infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        shimmer: "shimmer 1.5s ease-in-out infinite",
        "fade-in-up": "fade-in-up 0.6s ease-out forwards",
        "spin-slow": "spin-slow 20s linear infinite",
        "bounce-in": "bounce-in 0.5s cubic-bezier(0.34,1.56,0.64,1)",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "skeleton-wave": "skeleton-wave 1.5s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "33%": { transform: "translateY(-18px) rotate(1deg)" },
          "66%": { transform: "translateY(-10px) rotate(-1deg)" },
        },
        "float-delay": {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "33%": { transform: "translateY(-12px) rotate(-1deg)" },
          "66%": { transform: "translateY(-20px) rotate(1deg)" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(59,130,246,0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(59,130,246,0.6)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(30px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "bounce-in": {
          "0%": { transform: "scale(0.3)", opacity: "0" },
          "50%": { transform: "scale(1.05)" },
          "70%": { transform: "scale(0.95)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "skeleton-wave": {
          "0%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "-100% 50%" },
        },
      },
      backdropBlur: {
        xs: "2px",
        sm: "4px",
        md: "12px",
        lg: "20px",
        xl: "40px",
      },
      boxShadow: {
        glow: "0 0 40px rgba(59,130,246,0.3)",
        "glow-lg": "0 0 60px rgba(59,130,246,0.4)",
        card: "0 4px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.05)",
        "card-hover": "0 20px 50px rgba(30,58,138,0.15), 0 8px 20px rgba(30,58,138,0.08)",
        premium: "0 20px 60px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.08)",
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
        "4xl": "32px",
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
        26: "6.5rem",
        30: "7.5rem",
      },
      zIndex: {
        60: "60",
        70: "70",
        80: "80",
        90: "90",
        100: "100",
      },
      transitionTimingFunction: {
        bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};
