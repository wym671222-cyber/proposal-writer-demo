import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ring: "#1d4f46",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
