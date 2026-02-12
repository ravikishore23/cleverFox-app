export default {
  // Tailwind content globs are resolved relative to the current working
  // directory. In this repo we run Vite from the workspace root using
  // `--config client/vite.config.ts`, so include both root- and client-relative
  // patterns to avoid false "no utility classes detected" warnings.
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./client/index.html",
    "./client/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        fox: {
          orange: "#FF8A3D",
          light: "#FFD2B3",
        },
      },
    },
  },
  plugins: [],
};
