import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("portal continua funcional sem configurar ou executar o CMS", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /O que transforma vidas/ })).toBeVisible();
  await expect(page.locator(".activity-card")).toHaveCount(8);
});

test("noticias e eventos preservam arquivo historico quando CMS esta desligado", async ({ page }) => {
  await page.goto("/noticias");
  await expect(page.locator(".editorial-section:has(#clippings-title) .editorial-news")).toHaveCount(6);
  await expect(page.getByRole("heading", { name: "Registros publicados sobre o IERC-RN" })).toBeVisible();
  await page.goto("/eventos");
  await expect(page.locator(".editorial-event")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Próximos eventos" })).toBeVisible();
});

test("noticias privadas e inexistentes nao sao acessiveis por URL publica", async ({ page }) => {
  const response = await page.goto("/noticias/rascunho-nao-aprovado");
  expect(response?.status()).toBe(404);
  await expect(page.locator(".cms-article-body")).toHaveCount(0);
});

test("painel de gestao nao fica exposto dentro do front-end", async ({ page }) => {
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
});


test("Radar da Inclusão tem rota própria, explica a origem externa e não expõe rascunhos", async ({ page }) => {
  await page.goto("/noticias");
  const toRadar = page.getByRole("link", { name: "Explorar o Radar" });
  await expect(toRadar).toHaveAttribute("href", "/radar-da-inclusao");
  await toRadar.click();
  await expect(page).toHaveURL(/\/radar-da-inclusao$/);
  await expect(page.getByRole("heading", { level: 1, name: "Radar da Inclusão" })).toBeVisible();
  await expect(page.getByText(/Não representam atividades realizadas pelo IERC-RN/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Como selecionamos e publicamos" })).toBeVisible();

  // In the test environment CMS credentials are intentionally absent. Never
  // use seeded fake news or bypass the published + approved API contract.
  if (process.env.CMS_ENABLED !== "true") {
    await expect(page.getByRole("heading", { name: "Conteúdos em revisão editorial" })).toBeVisible();
    await expect(page.locator(".editorial-news")).toHaveCount(0);
  }
  await expect(page.getByRole("link", { name: /Ver notícias institucionais/i })).toHaveAttribute("href", "/noticias");
});

test("Radar é navegável no celular e atende às verificações automáticas WCAG A/AA", async ({ page }) => {
  await page.goto("/radar-da-inclusao");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("link", { name: /Ver notícias institucionais/i })).toHaveAttribute("href", "/noticias");
  const results = await new AxeBuilder({ page }).withTags([
    "wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa",
  ]).analyze();
  expect(results.violations).toEqual([]);
});
