import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("logo institucional carregada com nome acessível no link", async ({ page }) => {
  await page.goto("/");
  const link = page.locator("header a.brand");
  await expect(link).toBeVisible();
  await expect(link).toContainText("IERC");
  const logo = link.locator("img.brand-logo");
  await expect(logo).toHaveAttribute("alt", "");
  await expect(logo).toHaveAttribute("src", /ierc-logo/);
  await expect.poll(async () => logo.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});

test("atalho de acessibilidade está do lado direito e painel respeita Escape", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Acessibilidade", exact: true });
  const box = await trigger.boundingBox();
  if (!box) throw new Error("Botão de acessibilidade não apareceu");
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(box.x).toBeGreaterThan(page.viewportSize()!.width / 2);
  await trigger.click();
  const close = page.getByRole("button", { name: "Fechar preferências de acessibilidade" });
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page.locator("#painel-acessibilidade")).toBeHidden();
});

test("preferências de contraste e tamanho persistem após recarregar", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Acessibilidade", exact: true }).click();
  await page.getByRole("checkbox", { name: "Alto contraste" }).check();
  await page.getByRole("checkbox", { name: "Ampliar textos" }).check();
  await expect(page.locator("html")).toHaveAttribute("data-high-contrast", "true");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-high-contrast", "true");
  await expect(page.locator("html")).toHaveAttribute("data-large-text", "true");
  const fontSize = await page.locator("html").evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(19);
});

test("reflow em largura equivalente a 400% de zoom permite navegar sem rolagem lateral", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  for (const url of ["/", "/atividades", "/apoie", "/visitas"]) {
    await page.goto(url);
    await expect(page.getByRole("main")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "Overflow horizontal na rota " + url).toBeLessThanOrEqual(1);
  }
});

test("movimento reduzido do sistema é respeitado nos efeitos da interface", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const duration = await page.locator(".activity-card").first().evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(duration === "0.01ms" || duration === "1e-05s" || duration === "0s").toBeTruthy();
});

test("páginas-chave sem violações automáticas axe-core WCAG A/AA", async ({ page }) => {
  for (const url of ["/", "/atividades", "/esportes", "/apoie", "/visitas"]) {
    await page.goto(url);
    const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(audit.violations, "Axe: " + url).toEqual([]);
  }
});
