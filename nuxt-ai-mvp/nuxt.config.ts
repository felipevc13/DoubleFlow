import { fileURLToPath } from "url"; // <<< Add this import
import { VueMcp } from "vite-plugin-vue-mcp";
import { defineNuxtConfig } from "nuxt/config"; // <<< Add this import
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devServer: {
    port: 3000,
  },

  ssr: true,

  runtimeConfig: {
    // Server-only keys (not exposed to the client)
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    // Public keys available on the client
    public: {
      SUPABASE_URL:
        process.env.SUPABASE_URL || "http://localhost:54321/nuxt_config_mock",
      SUPABASE_ANON_KEY:
        process.env.SUPABASE_ANON_KEY || "mock_supabase_anon_key_nuxt_config",
    },
  },

  modules: ["@pinia/nuxt", "@nuxtjs/tailwindcss", "@vueuse/nuxt"],

  imports: {
    autoImport: true,
    dirs: [
      // Auto-import composables
      "composables",
      "composables/**",
      // Auto-import stores
      "stores",
      "stores/**",
    ],
  },

  build: {
    transpile: ["@vue-flow/core", "vue-router", "uuid"],
  },

  css: [
    "@vue-flow/core/dist/style.css",
    "@vue-flow/core/dist/theme-default.css",
    "@vue-flow/controls/dist/style.css",
    "@vue-flow/minimap/dist/style.css",
    "~/assets/css/main.css",
  ],

  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },

  nitro: {
    preset: "vercel",
    watchOptions: {
      ignored: ["**/.venv/**", "**/node_modules/**"],
    },
  },

  app: {
    head: {
      htmlAttrs: {
        lang: "pt-BR",
      },
      title: "DoubleFlow",
      titleTemplate: "%s - Visualize o Fluxo. Automatize o Insight.",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content:
            "DoubleFlow é a tela inteligente para organizar tarefas, criar pesquisas e automatizar a análise de dados qualitativos. Transforme suas ideias em ação.",
        },
        {
          property: "og:title",
          content: "DoubleFlow - Visualize o Fluxo. Automatize o Insight.",
        },
        {
          property: "og:description",
          content:
            "Organize tarefas, crie pesquisas e gere insights com o poder da IA em uma tela visual e inteligente.",
        },
        { property: "og:type", content: "website" },
        {
          property: "og:image",
          content: "URL_DA_SUA_IMAGEM_PRINCIPAL.png",
        },
        {
          name: "twitter:card",
          content: "summary_large_image",
        },
        { name: "theme-color", content: "#101935" },
      ],
      link: [{ rel: "icon", type: "image/svg+xml", href: "/logo.svg" }],
    },
  },

  compatibilityDate: "2025-04-03",

  devtools: { enabled: true, debug: true }, // Disable Nuxt DevTools

  experimental: {
    componentIslands: true,
  },

  components: {
    dirs: [
      {
        path: "~/components",
        global: true,
      },
    ],
  },

  vite: {
    // Add resolve.alias configuration for Vitest
    plugins: [VueMcp()],
    resolve: {
      alias: {
        "~": fileURLToPath(new URL("./", import.meta.url)),
      },
    },
    server: {
      watch: {
        ignored: ["**/.venv/**", "**/node_modules/**"],
      },
    },
    optimizeDeps: {
      exclude: ["uuid"],
      include: ["@vue-flow/core"],
    },
    ssr: {
      noExternal: ["vue-router"],
    },
  },
});
