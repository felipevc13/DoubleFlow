// playwright.config.ts
import { defineConfig as defineE2EConfig, devices } from "@playwright/test";
import { defineConfig as defineComponentConfig } from "@playwright/experimental-ct-vue";
import { fileURLToPath } from "url";
import vue from "@vitejs/plugin-vue";
import { mergeConfig } from "vite";
import nuxtConfig from "./nuxt.config";

// Common configuration for all projects
const commonConfig = {
  timeout: 120 * 1000, // 2 minutes
  expect: { timeout: 10 * 1000 }, // 10 seconds
  fullyParallel: false, // Run tests in sequence
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Use 1 worker to avoid overloading the dev server
  reporter: "html",
  outputDir: "playwright-screenshots",
};

// Component test configuration
const componentConfig = defineComponentConfig({
  ...commonConfig,
  testDir: "./tests/component",
  testMatch: "**/*.spec.{js,jsx,ts,tsx}",
  use: {
    ...devices["Desktop Chrome"],
    // Component testing specific configuration
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

// E2E test configuration
const e2eConfig = defineE2EConfig({
  ...commonConfig,
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.{js,ts}",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:3000",
  },
  // Web server for E2E tests
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes
    stdout: "pipe",
    stderr: "pipe",
    env: {
      NODE_ENV: "test",
    },
  },
});

// Determine which config to use based on the test command
const isComponentTest = process.argv.some((arg) => arg.includes("component"));
const config = isComponentTest ? componentConfig : e2eConfig;

export default config;
