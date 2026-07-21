import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0b0f14",
        surface: "#131a22",
        surface2: "#1a232d",
        border: "#26323d",
        muted: "#8b9aa8",
        text: "#e6edf3",
        accent: "#3b82f6",
        good: "#22c55e",
        warn: "#f59e0b",
        bad: "#ef4444",
      },
    },
  },
  plugins: [],
};

export default config;
