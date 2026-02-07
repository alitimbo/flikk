/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        "flikk-lime": "#CCFF00",
        "flikk-purple": "#A87FF3",
        "flikk-dark": "#121212",
        "flikk-card": "#1E1E1E",
        "flikk-text": "#FFFFFF",
        "flikk-text-muted": "#B3B3B3",
      },
    },
  },
  plugins: [],
};
