import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("página inicial tem conteúdo principal e links úteis", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("abrir possibilidades");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("link", { name: /Conheça o Instituto/i }).first()).toHaveAttribute("href", "/instituto");
  await expect(page.getByRole("link", { name: /Conheça o bazar/i })).toHaveAttribute("href", "/apoie");
});

test("atalho por teclado alcança o conteúdo principal", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Pular para o conteúdo principal" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#conteudo$/);
});

test("preferências de acessibilidade funcionam e são persistidas", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Acessibilidade/i }).click();
  await page.getByRole("checkbox", { name: "Ampliar textos" }).check();
  await page.getByRole("checkbox", { name: "Reduzir animações" }).check();
  await expect(page.locator("html")).toHaveAttribute("data-large-text", "true");
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "true");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "true");
});

test("menu móvel abre e fecha com teclado", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Aplica-se ao viewport móvel");
  await page.goto("/");
  const open = page.getByRole("button", { name: "Abrir menu" });
  await open.click();
  await expect(page.getByRole("button", { name: "Fechar menu" })).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Abrir menu" })).toBeFocused();
  await expect(page.locator("#menu-principal")).not.toBeVisible();
});

test("páginas principais respondem sem conteúdo fictício", async ({ page }) => {
  for (const path of ["/atividades", "/esportes", "/historias", "/apoie", "/visitas", "/noticias", "/eventos", "/galeria", "/contato"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
  }
});

test("página inicial atende verificações automáticas WCAG A/AA", async ({ page }) => {
  await page.goto("/");
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(result.violations).toEqual([]);
});
