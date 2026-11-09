import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("instituto documenta fundação e linha do tempo com fontes", async ({ page }) => {
  await page.goto("/instituto");
  await expect(page.getByText("Fundado em 16 de julho de 1952")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Uma trajetória que atravessa décadas" })).toBeVisible();
  await expect(page.locator(".editorial-timeline li")).toHaveCount(4);
  await expect(page.locator('.editorial-timeline a[target="_blank"]')).toHaveCount(4);
});

test("esporte diferencia registro público de elenco atual", async ({ page }) => {
  await page.goto("/esportes");
  await expect(page.getByRole("heading", { name: "Equipes registradas pela CBDV" })).toBeVisible();
  await expect(page.getByText("Ana Cláudia Alves de Souza Santos")).toBeVisible();
  await expect(page.getByText("Luciana Ferreira da Silva", { exact: true })).toBeVisible();
  await expect(page.locator(".sport-roster li")).toHaveCount(6);
  await expect(page.getByText(/não representam escalação atual/)).toBeVisible();
});

test("histórias não atribuem vínculo a nomes não verificados", async ({ page }) => {
  await page.goto("/historias");
  await expect(page.getByRole("heading", { name: "Pautas em preparação" })).toBeVisible();
  for (const name of ["Rosicleide Andrade", "Romário Marques", "Thalita Simplício"]) {
    await expect(page.getByText(name)).toHaveCount(0);
  }
});

test("notícias exibem clippings de terceiros com links e datas", async ({ page }) => {
  await page.goto("/noticias");
  await expect(page.getByRole("heading", { name: "Registros publicados sobre o IERC-RN" })).toBeVisible();
  await expect(page.locator(".editorial-news")).toHaveCount(3);
  await expect(page.locator('.editorial-news a[target="_blank"]')).toHaveCount(3);
  await expect(page.getByText(/Não foram criadas notícias fictícias/)).toBeVisible();
});

test("eventos arquivados não simulam agenda futura", async ({ page }) => {
  await page.goto("/eventos");
  await expect(page.locator(".editorial-event")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Próximos eventos" })).toBeVisible();
  await expect(page.getByText(/Não há inscrições, ingressos ou datas futuras/)).toBeVisible();
});

test("endereço de contato é verificável e não há telefone fictício", async ({ page }) => {
  await page.goto("/contato");
  await expect(page.locator(".verified-address")).toContainText("Rua Fonseca e Silva, 1113");
  await expect(page.locator('a[href^="tel:"],a[href^="mailto:"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Ver endereço citado pelo TRE-RN/ })).toHaveAttribute("target", "_blank");
});

test("visitas não ativa agendamento sem URL oficial", async ({ page }) => {
  await page.goto("/visitas");
  await expect(page.getByText(/não foi fornecido/)).toBeVisible();
  await expect(page.locator("form")).toHaveCount(0);
});

test("seções editoriais mantêm reflow e testes automáticos de acessibilidade", async ({ page }) => {
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    for (const route of ["/instituto", "/esportes", "/noticias", "/eventos", "/contato"]) {
      await page.goto(route);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, "Rolagem horizontal em " + route + " / " + width + "px").toBeLessThanOrEqual(1);
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const route of ["/instituto", "/esportes", "/noticias", "/contato"]) {
    await page.goto(route);
    const audit = await new AxeBuilder({ page }).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]).analyze();
    expect(audit.violations, "axe: " + route).toEqual([]);
  }
});
