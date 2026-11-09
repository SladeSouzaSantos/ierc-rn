import { expect, test } from "@playwright/test";

test("portal continua funcional sem configurar ou executar o CMS", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /O que transforma vidas/ })).toBeVisible();
  await expect(page.locator(".activity-card")).toHaveCount(8);
});

test("noticias e eventos preservam arquivo historico quando CMS esta desligado", async ({ page }) => {
  await page.goto("/noticias");
  await expect(page.locator(".editorial-news")).toHaveCount(3);
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
