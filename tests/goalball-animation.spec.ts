import { expect, test } from "@playwright/test";

test("o novo hero usa exatamente o SVG fornecido e a quadra não contém a bola", async ({ request }) => {
  const hero = await request.get("/illustrations/leitura-tatil.svg");
  expect(hero.ok()).toBeTruthy();
  const heroContent = await hero.text();
  expect(heroContent).toContain('<svg width="294" height="237"');
  expect(heroContent).toContain("data:image/png;base64,");

  const court = await request.get("/illustrations/goalball-quadra.svg");
  const ball = await request.get("/illustrations/goalball-bola.svg");
  expect(court.ok()).toBeTruthy();
  expect(ball.ok()).toBeTruthy();
  const courtContent = await court.text();
  expect(courtContent).toContain("Gol e rede de goalball");
  expect(courtContent).not.toContain("Bola sonora, com orifícios");
  expect(courtContent).not.toContain('id="ball"');
  expect(await ball.text()).toContain('id="orificio"');
});

test("o efeito de goalball é visual: não reproduz áudio", async ({ page }) => {
  await page.goto("/");
  const scene = page.locator(".goalball-scene");
  await scene.scrollIntoViewIfNeeded();
  await expect(scene.locator(".goalball-ball img")).toHaveAttribute("src", "/illustrations/goalball-bola.svg");
  await expect(scene.locator(".goalball-echo")).toHaveCount(2);
  await expect(scene).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("audio, video")).toHaveCount(0);
  await expect(scene).toHaveAttribute("data-motion", "active");
});

test("redução de movimento do sistema interrompe o quique e os ecos", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const scene = page.locator(".goalball-scene");
  await scene.scrollIntoViewIfNeeded();
  await expect(scene).toHaveAttribute("data-motion", "reduced");
  const ball = scene.locator(".goalball-ball");
  const before = await ball.evaluate((node) => getComputedStyle(node).transform);
  await page.waitForTimeout(350);
  const after = await ball.evaluate((node) => getComputedStyle(node).transform);
  expect(after).toBe(before);
  const opacity = await scene.locator(".goalball-echo").first().evaluate((node) => getComputedStyle(node).opacity);
  expect(opacity).toBe("0");
});

test("preferência de acessibilidade do site pausa e reativa o movimento", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const scene = page.locator(".goalball-scene");
  await scene.scrollIntoViewIfNeeded();
  await expect(scene).toHaveAttribute("data-motion", "active");
  await page.getByRole("button", { name: "Acessibilidade", exact: true }).click();
  await page.getByRole("checkbox", { name: "Reduzir animações" }).check();
  await expect(scene).toHaveAttribute("data-motion", "reduced");
  await page.getByRole("checkbox", { name: "Reduzir animações" }).uncheck();
  await expect(scene).toHaveAttribute("data-motion", "active");
});

test("as ondas de eco ficam visíveis durante o impacto com animação permitida", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const scene = page.locator(".goalball-scene");
  await scene.scrollIntoViewIfNeeded();
  await expect(scene).toHaveAttribute("data-motion", "active");
  const wave = scene.locator(".goalball-echo").first();
  // O impacto ocorre após o primeiro quique; a onda é visível por menos de um segundo.
  await expect.poll(
    () => wave.evaluate((element) => Number(getComputedStyle(element).opacity)),
    { timeout: 12000, intervals: [120, 120, 120, 120, 120, 120] },
  ).toBeGreaterThan(0.06);
});
