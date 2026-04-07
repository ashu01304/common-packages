import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "FormstrAuth",
      formats: ["es", "umd"],
      fileName: (format) => `formstr-auth.${format === "es" ? "js" : "umd.cjs"}`,
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "@mui/material",
        "@emotion/react",
        "@emotion/styled",
        "nostr-tools",
        "@noble/hashes"
      ],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "@mui/material": "MaterialUI",
          "@emotion/react": "EmotionReact",
          "@emotion/styled": "EmotionStyled",
          "nostr-tools": "NostrTools",
        },
      },
    },
  },
});
