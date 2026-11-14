import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("capa apresenta leitura tátil sem depender da ilustração para informar", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("abrir possibilidades");
  await expect(page.locator(".hero-art")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".hero-lead")).toContainText("educação, autonomia, cultura e esporte");
  const image = page.locator(".hero-art-illustration");
  await expect(image).toHaveAttribute("alt", "");
  await expect(image).toHaveAttribute("src", "/illustrations/leitura-tatil.svg");
  await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});

test("bloco de goalball inclui imagem de quadra e bola sonora meramente decorativa", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /O som da bola/ })).toBeVisible();
  const illustration = page.locator(".sport-art");
  await expect(illustration).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".sport-copy")).toContainText("O goalball faz parte da vida esportiva");
  const image = illustration.locator(".sport-art-illustration");
  // Next/Image carrega imagens abaixo da dobra sob demanda: simular rolagem real.
  await image.scrollIntoViewIfNeeded();
  await expect(image).toHaveAttribute("alt", "");
  await expect(image).toHaveAttribute("src", "/illustrations/goalball-quadra.svg");
  await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});

test("os SVGs são locais, legíveis e não carregam scripts externos", async ({ request }) => {
  for (const resource of ["/illustrations/leitura-tatil.svg", "/illustrations/goalball-quadra.svg"]) {
    const response = await request.get(resource);
    expect(response.ok(), resource).toBeTruthy();
    const content = await response.text();
    expect(content).toContain("<svg");
    expect(content).toContain("</svg>");
    expect(content).not.toMatch(/<script|<foreignObject|(?:href|src)\s*=\s*["\x27]https?:/i);
  }
});

test("artes mantêm layout sem rolagem horizontal em tela estreita", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await expect(page.locator(".hero-art-illustration")).toBeVisible();
  await expect(page.locator(".sport-art-illustration")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("hero empilhado mantém a ilustração encostada ao limite inferior da faixa azul", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 375, 600, 760]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const section = await page.locator(".hero").boundingBox();
    const art = await page.locator(".hero-art").boundingBox();
    const visual = await page.locator(".hero-art-visual").boundingBox();
    if (!section || !art || !visual) throw new Error("Hero não renderizado");
    const bottom = section.y + section.height;
    expect(Math.abs(art.y + art.height - bottom), `Sem espaço após a arte em ${width}px`).toBeLessThanOrEqual(1);
    expect(visual.y + visual.height, `Arte alcança a borda em ${width}px`).toBeGreaterThanOrEqual(bottom + 4);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Sem transbordamento horizontal em ${width}px`).toBeLessThanOrEqual(1);
  }
});

test("modo de movimento reduzido não desloca a arte principal", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const illustration = page.locator(".hero-art-visual");
  await expect(illustration).toBeVisible();
  const before = await illustration.evaluate((element) => getComputedStyle(element).transform);
  await page.waitForTimeout(260);
  const after = await illustration.evaluate((element) => getComputedStyle(element).transform);
  expect(after).toBe(before);
});

test("homepage redesenhada continua sem violações automatizadas axe-core A/AA", async ({ page }) => {
  await page.goto("/");
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"])
    .analyze();
  expect(result.violations).toEqual([]);
});

test("no desktop, artes do modelo ocupam sua coluna sem substituir conteúdo textual", async ({ page, isMobile }) => {
  test.skip(isMobile, "Medições se aplicam à composição desktop");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const hero = await page.locator(".hero").boundingBox();
  const art = await page.locator(".hero-art").boundingBox();
  const sport = await page.locator(".sport-art").boundingBox();
  if (!hero || !art || !sport) throw new Error("Uma das áreas visuais não foi renderizada");
  expect(art.width).toBeGreaterThan(hero.width * 0.34);
  expect(art.height).toBeGreaterThan(450);
  expect(sport.width / sport.height).toBeGreaterThan(1.25);
  await expect(page.getByRole("link", { name: "Conheça o Instituto" }).first()).toBeVisible();
});
