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
        primary: "#1e3a8a", // Soft deep blue
        secondary: "#3b82f6", // Bright blue
        accent: "#1d4ed8", // Strong blue
        softBg: "#f8fafc", // Very soft blue-grey
      },
    },
  },
  plugins: [],
};
