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

test("noticias priorizam a secao oficial mesmo sem conteudo CMS aprovado", async ({ page }) => {
  if (process.env.CMS_ENABLED === "true") return;
  await page.goto("/noticias");

  const official = page.locator(".editorial-section:has(#cms-news-title)");
  const external = page.locator(".editorial-section:has(#clippings-title)");
  await expect(official.getByRole("heading", { name: "Notícias da equipe do IERC-RN" })).toBeVisible();
  await expect(official.getByRole("heading", { name: "Publicações institucionais em preparação" })).toBeVisible();
  await expect(official.getByText(/Ainda não há notícias oficiais publicadas e aprovadas nesta seção/)).toBeVisible();
  await expect(official.locator(".editorial-news")).toHaveCount(0);

  // The official section must precede external clippings in document order.
  const order = await page.locator("#cms-news-title, #clippings-title")
    .evaluateAll(nodes => nodes.map(node => node.id));
  expect(order).toEqual(["cms-news-title", "clippings-title"]);
  await expect(external.locator(".editorial-news")).toHaveCount(6);
  await expect(page.getByRole("link", { name: "Explorar o Radar" })).toHaveAttribute("href", "/radar-da-inclusao");
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
