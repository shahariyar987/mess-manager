import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: { ink: "#17211d", cream: "#f7f8f5", sage: "#8cae9a", moss: "#35624a", terracotta: "#d87655", line: "#e3e8e3" },
      fontFamily: { sans: ["var(--font-inter)", "sans-serif"], display: ["var(--font-dm-sans)", "sans-serif"] }
    }
  },
  plugins: []
};
export default config;
