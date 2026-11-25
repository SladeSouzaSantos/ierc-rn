import { expect, test } from "@playwright/test";

const routes = [
  ["/", "home"],
  ["/instituto", "instituto"],
  ["/atividades", "atividades"],
  ["/esportes", "esportes"],
  ["/historias", "historias"],
  ["/noticias", "noticias"],
  ["/eventos", "eventos"],
  ["/galeria", "galeria"],
  ["/visitas", "visitas"],
  ["/apoie", "apoie"],
  ["/contato", "contato"],
  ["/radar-da-inclusao", "radar"],
] as const;

for (const [route, variant] of routes) {
  test(`premium: ${route} — estrutura, reflow e captura de referência`, async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const response = await page.goto(route);
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (route !== "/") {
      await expect(page.locator(".interior-hero")).toHaveAttribute("data-editorial-variant", variant);
    }
    await page.screenshot({ path: testInfo.outputPath(`premium-${variant}.png`), fullPage: true, animations: "disabled", timeout: 20_000 });
    await page.setViewportSize({ width: 320, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}

test("premium: arte hero tem entrada finita; preferência local desativa animação", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const art = page.locator(".hero-art-visual");
  await expect(art).toHaveCSS("animation-iteration-count", "1");
  await expect(art).toHaveCSS("animation-name", "premium-art-in");
  await page.getByRole("button", { name: "Acessibilidade", exact: true }).click();
  await page.getByRole("checkbox", { name: "Reduzir animações" }).check();
  await expect(art).toHaveCSS("animation-name", "none");
  await page.getByRole("checkbox", { name: "Alto contraste" }).check();
  await expect(page.locator("html")).toHaveAttribute("data-high-contrast", "true");
  await expect(page.locator(".hero")).toHaveCSS("background-color", "rgb(0, 0, 0)");
});

test("premium: preferências do sistema não ocultam conteúdo sem JavaScript", async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:3000",
    javaScriptEnabled: false,
    reducedMotion: "reduce",
    viewport: { width: testInfo.project.name.includes("mobile") ? 390 : 1440, height: 900 },
  });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".hero-art-visual")).toHaveCSS("animation-name", "none");
    await expect(page.getByRole("link", { name: "Conheça o Instituto" }).first()).toBeVisible();
  } finally {
    await context.close();
  }
});

test("premium: página de erro mantém recuperação acessível", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const response = await page.goto("/noticias/rascunho-nao-aprovado");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Voltar ao início" })).toHaveAttribute("href", "/");
  await page.screenshot({ path: testInfo.outputPath("premium-404.png"), fullPage: true, animations: "disabled" });
});

test("premium v2: capítulos, índice editorial, arte por contexto e motion opt-in", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-ui-experiment", "editorial-v2");
  await expect(page.getByRole("navigation", { name: "Explore a página inicial" }).getByRole("link")).toHaveCount(4);
  await expect(page.locator(".heritage-year strong")).toHaveText("1952");
  await expect(page.locator(".activity-card .activity-index")).toHaveCount(8);
  const motif = page.locator(".heritage-art");
  await motif.scrollIntoViewIfNeeded();
  await expect(motif).toHaveAttribute("data-motif-motion", "entered");
  await page.getByRole("button", { name: "Acessibilidade", exact: true }).click();
  await page.getByRole("checkbox", { name: "Reduzir animações" }).check();
  await expect(motif.locator(".motif-gesture")).toHaveCSS("animation-name", "none");
  await page.goto("/radar-da-inclusao");
  await expect(page.locator(".interior-cover-art")).toHaveAttribute("data-motif", "signal");
  await page.goto("/atividades");
  await expect(page.locator(".interior-cover-art")).toHaveAttribute("data-motif", "grid");
});
