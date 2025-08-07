import { fileURLToPath } from "url"; // <<< Add this import
import { VueMcp } from "vite-plugin-vue-mcp";
import { defineNuxtConfig } from "nuxt/config"; // <<< Add this import
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devServer: {
    port: 3000,
  },

  ssr: true,

  modules: [
    "@pinia/nuxt",
    "@nuxtjs/tailwindcss",
    "@vueuse/nuxt",
    "@nuxtjs/supabase",
  ],

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

  // Configure the Supabase module directly
  // @ts-ignore - Supabase module adds this property, but TypeScript isn't recognizing it here.
  supabase: {
    redirect: false,
    url: process.env.SUPABASE_URL || "http://localhost:54321/nuxt_config_mock", // Provide mock URL directly to the module
    key: process.env.SUPABASE_KEY || "mock_supabase_key_nuxt_config", // Provide mock key directly to the module
    mock: process.env.NODE_ENV === "test", // Enable mocking for test environment
    clientOptions: {
      auth: {
        // Recommended settings for tests/SSR
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  },
  db: {
    schema: "./types/supabase.ts",
  },

  // runtimeConfig will be populated by the @nuxtjs/supabase module based on the above config

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
