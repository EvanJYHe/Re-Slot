/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/web/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f6f7f4",
        panel: "#ffffff",
        ink: "#202722",
        muted: "#6d766f",
        line: "#e2e6e1",
        "revive": "#19724b",
        "revive-dark": "#105336",
        amber: "#eaa63a",
        "amber-soft": "#fff5df",
      },
      fontFamily: {
        sans: ["Instrument Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        "revive": "8px",
      },
      boxShadow: {
        panel: "0 1px 2px rgba(23, 35, 28, 0.04), 0 10px 28px rgba(23, 35, 28, 0.04)",
      },
    },
  },
  plugins: [],
};
