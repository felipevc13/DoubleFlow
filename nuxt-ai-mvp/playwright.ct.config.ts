// playwright.ct.config.ts
import { defineConfig, devices } from "@playwright/experimental-ct-vue";
import { fileURLToPath } from "url";
import vue from "@vitejs/plugin-vue";
import { mergeConfig } from "vite";
import nuxtConfig from "./nuxt.config";

export default defineConfig({
  testDir: "./tests/component",
  testMatch: "**/*.spec.{js,jsx,ts,tsx}",
  timeout: 120 * 1000, // 2 minutes
  expect: { timeout: 10 * 1000 }, // 10 seconds
  fullyParallel: false, // Run tests in sequence
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Use 1 worker to avoid overloading the dev server
  reporter: "html",
  outputDir: "playwright-screenshots",

  use: {
    ...devices["Desktop Chrome"],
    headless: false, // Run tests in headed mode
    trace: "on-first-retry",
    screenshot: "on",
    actionTimeout: 15 * 1000,
    navigationTimeout: 60 * 1000,
    // baseURL should not be set for component tests
    ctPort: 3100,
    ctViteConfig: mergeConfig(nuxtConfig.vite || {}, {
      plugins: [vue()],
      resolve: {
        alias: [
          {
            find: "~",
            replacement: fileURLToPath(new URL("./", import.meta.url)),
          },
        ],
      },
    }),
  },
});
