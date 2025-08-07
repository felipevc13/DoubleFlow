import { chromium, expect } from "@playwright/test";

export default async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // 1. Faz login só uma vez
  await page.goto("http://localhost:3000/login");
  await page.fill("input#email", "felipevc13@gmail.com");
  await page.fill("input#password", "Qw@rty01313");
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForURL((url) => !url.pathname.includes("/login")),
  ]);

  // 2. Garante que chegou na área logada
  await page.waitForSelector(".vue-flow-wrapper", { timeout: 30000 });

  // 3. Salva cookies + localStorage
  await page.context().storageState({ path: "storage/auth.json" });
  await browser.close();
};
