import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";
import path from "path";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./tests/vitest/setupVitest.ts"], // Added setup file
    deps: {
      // Inline significa que o Vitest vai importar essas dependências diretamente em vez
      // de tentar resolver seus caminhos, o que evita erros de resolução
      inline: [/nuxt/, /@nuxt/, /@vue/, /^uuid($|\/)/, /@langchain\/core/],
    },
    mockReset: true,
  },
  resolve: {
    alias: [
      {
        find: "~/server",
        replacement: path.resolve(__dirname, "./server"),
      },
      {
        find: "~",
        replacement: path.resolve(__dirname, "./"),
      },
      {
        find: "@",
        replacement: path.resolve(__dirname, "./"),
      },
      // These aliases are critical for resolving "Missing ./dist/app/nuxt.js"
      {
        find: "#app",
        replacement: path.resolve(__dirname, "./tests/mocks/nuxt.ts"),
      },
      {
        find: "nuxt/app",
        replacement: path.resolve(__dirname, "./node_modules/nuxt/dist/app"),
      },
      {
        find: "nuxt/dist/app/nuxt.js",
        replacement: path.resolve(__dirname, "./tests/mocks/nuxt.ts"),
      },
      {
        find: "#imports",
        replacement: path.resolve(__dirname, "./tests/mocks/imports.ts"),
      },
      {
        find: "#supabase/server",
        replacement: path.resolve(__dirname, "./tests/mocks/supabaseServer.ts"),
      },
      {
        find: "#build",
        replacement: path.resolve(__dirname, "./.nuxt"),
      },

      {
        find: "ansi-styles",
        replacement: fileURLToPath(
          new URL("./tests/vitest/__mocks__/ansi-styles.ts", import.meta.url)
        ),
      },
      {
        find: /^(@langchain\/core\/)?node_modules\/uuid$/,
        replacement: path.resolve(__dirname, "node_modules/uuid"),
      },
    ],
  },
});
