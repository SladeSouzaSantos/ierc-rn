import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Apoie apresenta os três caminhos não financeiros e informação clara sobre o bazar", async ({ page }) => {
  await page.goto("/apoie");

  await expect(page.getByRole("heading", { level: 1, name: "Apoie o IERC-RN" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bazar Solidário", exact: true })).toBeVisible();
  await expect(page.getByText(/Terças-feiras, das 8h às 11h/).first()).toBeVisible();
  await expect(page.getByText(/Em feriados ou mudanças excepcionais/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Doar itens para o bazar" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Conhecer o Bazar Solidário" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Voluntariado e parcerias" })).toBeVisible();

  const choices = page.locator(".support-choice");
  await expect(choices).toHaveCount(3);
  await expect(page.locator(".support-steps li")).toHaveCount(3);
  await expect(page.getByText(/Entrega: presencial, no IERC-RN/)).toBeVisible();
});

test("Apoie distingue pagamentos presenciais e doações financeiras sem divulgar credenciais", async ({ page }) => {
  await page.goto("/apoie");

  await expect(page.getByRole("heading", { name: "Sobre doações financeiras" })).toBeVisible();
  await expect(page.getByText(/O IERC-RN informou que possui um Pix oficial para doações financeiras/)).toBeVisible();
  await expect(page.getByText(/A chave e a titularidade ainda não foram verificadas/)).toBeVisible();
  await expect(page.getByText(/O Pix e o dinheiro aceitos no bazar referem-se a compras presenciais/)).toBeVisible();
  await expect(page.locator('main form, main input, main a[href^="pix:"], main a[href*="checkout"], main a[href*="payment"]')).toHaveCount(0);
  await expect(page.locator('main a[href^="tel:"], main a[href^="mailto:"]')).toHaveCount(0);

  const actions = page.locator('.support-bazar a[href="/contato"], .support-choice a[href="/contato"], .support-contact a[href="/contato"]');
  await expect(actions).toHaveCount(4);
  const social = page.locator('.support-choice a[href="https://www.instagram.com/iercrn/"]');
  await expect(social).toHaveAttribute("target", "_blank");
  await expect(social).toHaveAttribute("rel", /noopener noreferrer/);
  await expect(social.getByText(/abre em nova aba/)).toHaveCount(1);
});

test("Bazar exibe horários, local, itens aceitos e compra presencial conforme informação recebida", async ({ page }) => {
  await page.goto("/apoie");
  const bazar = page.locator("#bazar-solidario");
  await expect(bazar.getByText(/Terças-feiras, das 8h às 11h/)).toBeVisible();
  await expect(bazar.getByText(/Rua Fonseca e Silva, 1113/)).toBeVisible();
  await expect(bazar.getByText(/Doação de itens: segunda a quinta-feira, das 8h às 11h/)).toBeVisible();
  await expect(bazar.getByText(/O que doar: roupas, sapatos e bolsas em bom estado/)).toBeVisible();
  await expect(bazar.getByText(/Não há coleta domiciliar/)).toBeVisible();
  await expect(bazar.getByText(/Compras: abertas a qualquer pessoa/)).toBeVisible();
  await expect(bazar.getByText(/dinheiro ou Pix/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Voluntariado e parcerias" })).toBeVisible();

  // Institutional contacts and financial identifiers are deliberately absent.
  const publicText = await page.locator("main").innerText();
  expect(publicText).not.toMatch(/Nat[aá]lia|tia Gleide/i);
  await expect(page.locator('main a[href^="pix:"], main img[src*="qr"], main form')).toHaveCount(0);
});

test("Navegação interna da seção Apoie utiliza âncoras existentes", async ({ page }) => {
  await page.goto("/apoie");
  const menu = page.getByRole("navigation", { name: "Nesta página" });
  await expect(menu.getByRole("link")).toHaveCount(3);
  for (const [text, hash] of [
    ["Bazar Solidário", "#bazar-solidario"],
    ["Como participar", "#formas-de-apoio"],
    ["Orientações importantes", "#orientacoes-de-apoio"],
  ]) {
    const action = menu.getByRole("link", { name: text });
    await expect(action).toHaveAttribute("href", hash);
    await expect(page.locator(hash)).toHaveCount(1);
  }
  await menu.getByRole("link", { name: "Como participar" }).click();
  await expect(page).toHaveURL(/\/apoie#formas-de-apoio$/);
});

test("Ícones das três formas de apoio ficam centralizados em seus fundos", async ({ page }) => {
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/apoie");
    const positions = await page.locator(".support-choice > .support-choice-icon")
      .evaluateAll(wrappers => wrappers.map(element => {
        const icon = element.querySelector("svg");
        if (!icon) return null;
        const wrapper = element.getBoundingClientRect();
        const svg = icon.getBoundingClientRect();
        return {
          layout: getComputedStyle(element).display,
          dx: (svg.left + svg.width / 2) - (wrapper.left + wrapper.width / 2),
          dy: (svg.top + svg.height / 2) - (wrapper.top + wrapper.height / 2),
        };
      }));
    expect(positions).toHaveLength(3);
    for (const position of positions) {
      expect(position?.layout).toBe("flex");
      expect(Math.abs(position?.dx ?? Infinity), `Desvio horizontal no viewport ${width}px`).toBeLessThanOrEqual(1);
      expect(Math.abs(position?.dy ?? Infinity), `Desvio vertical no viewport ${width}px`).toBeLessThanOrEqual(1);
    }
  }
});

test("Apoie preserva responsividade e não cria rolagem horizontal", async ({ page }) => {
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/apoie");
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "Rolagem horizontal em Apoie / " + width + "px").toBeLessThanOrEqual(1);
  }
});

test("Apoie passa na auditoria automática de acessibilidade WCAG A/AA", async ({ page }) => {
  await page.goto("/apoie");
  const accessibility = await new AxeBuilder({ page }).withTags([
    "wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa",
  ]).analyze();
  expect(accessibility.violations).toEqual([]);
});
