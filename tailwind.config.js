/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#F97316", dark: "#EA580C" },
        dark:  { DEFAULT: "#0F172A", card: "#1E293B", border: "#334155" },
      },
    },
  },
  plugins: [],
};
