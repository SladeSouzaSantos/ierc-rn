import { test, expect } from "@playwright/test";

// Capturas de referência da versão DEV. Arquivos ficam nos artefatos do GitHub Actions.
test("gerar prévias visuais da homepage e do esporte", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("homepage.png"), fullPage: true, animations: "disabled" });
  await page.goto("/esportes");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("esportes.png"), fullPage: true, animations: "disabled" });
});

test("gerar prévia visual dos perfis de atletas com créditos fotográficos", async ({ page }, testInfo) => {
  await page.goto("/historias");
  await expect(page.locator(".athlete-story")).toHaveCount(9);
  // Ativa carregamento lazy das imagens externas antes de capturar toda a página.
  for (const card of await page.locator(".athlete-story").all()) {
    await card.scrollIntoViewIfNeeded();
  }
  await page.screenshot({
    path: testInfo.outputPath("athlete-profiles.png"),
    fullPage: true,
    animations: "disabled",
  });
});
