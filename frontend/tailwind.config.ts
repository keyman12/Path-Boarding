import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Path brand – primary (green)
        "path-primary": "#297D2D",
        "path-primary-light-1": "#3B9F40",
        "path-primary-light-2": "#49BC4E",
        // Path brand – secondary (red/coral)
        "path-secondary": "#FF5252",
        "path-secondary-light-1": "#FF8A80",
        "path-secondary-light-2": "#FFA49C",
        // Greyscale
        "path-grey-900": "#1a1a1a",
        "path-grey-700": "#4a4a4a",
        "path-grey-600": "#5c5c5c",
        "path-grey-500": "#737373",
        "path-grey-300": "#a3a3a3",
        "path-grey-100": "#f5f5f5",
      },
      fontFamily: {
        poppins: ["var(--font-poppins)", "sans-serif"],
        roboto: ["var(--font-roboto)", "sans-serif"],
      },
      fontSize: {
        "path-h0": ["72px", { lineHeight: "1.1" }],
        "path-h1": ["48px", { lineHeight: "1.2" }],
        "path-h2": ["32px", { lineHeight: "1.25" }],
        "path-h3": ["24px", { lineHeight: "1.3" }],
        "path-h4": ["18px", { lineHeight: "1.4" }],
        "path-p1": ["16px", { lineHeight: "1.5" }],
        "path-p2": ["14px", { lineHeight: "1.5" }],
      },
    },
  },
  plugins: [],
};
export default config;
