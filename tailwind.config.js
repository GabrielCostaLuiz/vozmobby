/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],

  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: "#CCFF00", // Neon Lime
        secondary: "#FF0099", // Hot Pink
        surface: "#1A1A1A", // Surface Dark
        "background-dark": "#000000", // OLED Black
        stroke: "#333333", // Borders
      },
      fontFamily: {
        display: ["Lexend_700Bold", "sans-serif"],
        mono: ["SpaceMono_700Bold", "monospace"],
      },
    },
  },
  plugins: [],
};
