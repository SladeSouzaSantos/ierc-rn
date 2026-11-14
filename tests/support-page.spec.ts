import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Apoie apresenta bazar, doações e parcerias sem divulgar voluntariado", async ({ page }) => {
  await page.goto("/apoie");

  await expect(page.getByRole("heading", { level: 1, name: "Apoie o IERC-RN" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bazar Solidário", exact: true })).toBeVisible();
  await expect(page.getByText(/Terças-feiras, das 8h às 11h/).first()).toBeVisible();
  await expect(page.getByText(/Em feriados ou mudanças excepcionais/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Doar itens para o bazar" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Conhecer o Bazar Solidário" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Parcerias institucionais" })).toBeVisible();

  const choices = page.locator(".support-choice");
  await expect(choices).toHaveCount(5);
  await expect(page.getByRole("heading", { name: "Alimentos não perecíveis" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Material de limpeza" })).toBeVisible();
  await expect(page.locator(".support-steps li")).toHaveCount(3);
  await expect(page.getByText(/Entrega: presencial, no IERC-RN/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Propor uma parceria/ })).toHaveAttribute("href", "/contato");
  await expect(page.locator("main")).not.toContainText(/voluntari/i);
});

test("Apoie apresenta chave Pix CNPJ informada sem iniciar cobranças online", async ({ page }) => {
  await page.goto("/apoie");

  await expect(page.getByRole("heading", { name: "Sobre doações financeiras" })).toBeVisible();
  await expect(page.getByText("08.049.504/0001-08", { exact: true })).toBeVisible();
  await expect(page.getByText(/confira no aplicativo do seu banco se o destinatário corresponde/)).toBeVisible();
  await expect(page.getByText(/Se o nome do recebedor não corresponder/)).toBeVisible();
  await expect(page.getByText(/O Pix e o dinheiro aceitos no bazar referem-se a compras presenciais/)).toBeVisible();
  await expect(page.locator('main input[type="text"], main input[type="email"], main input[type="number"], main input[type="password"], main input[autocomplete="cc-number"], main a[href^="pix:"], main iframe')).toHaveCount(0);
  await expect(page.locator('.support-recurring-checkout')).toBeDisabled();
  // Email is the official cancellation/support channel, not a payment collection form.
  await expect(page.locator('main a[href^="tel:"]')).toHaveCount(0);
  await expect(page.locator('main a[href^="mailto:"]')).toHaveCount(1);

  const actions = page.locator('.support-bazar a[href="/contato"], .support-choice a[href="/contato"], .support-contact a[href="/contato"]');
  await expect(actions).toHaveCount(7);
  await expect(page.locator('.support-choice a[href="https://www.instagram.com/iercrn/"]')).toHaveCount(0);
});

test("Botão Pix copia apenas os dígitos do CNPJ e anuncia o resultado", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value: string) => { (window as typeof window & { __pixCopied?: string }).__pixCopied = value; } },
    });
  });
  await page.goto("/apoie");
  await page.getByRole("button", { name: "Copiar chave Pix" }).click();
  await expect(page.locator('.support-pix-status')).toContainText("Chave Pix copiada");
  const copied = await page.evaluate(() => (window as typeof window & { __pixCopied?: string }).__pixCopied);
  expect(copied).toBe("08049504000108");
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
  await expect(page.getByRole("heading", { name: "Parcerias institucionais" })).toBeVisible();

  // Staff names stay private; Pix CNPJ is intentionally public.
  const publicText = await page.locator("main").innerText();
  expect(publicText).not.toMatch(/Nat[aá]lia|tia Gleide/i);
  await expect(page.locator('main a[href^="pix:"], main img[src*="qr"], main input[autocomplete^="cc-"]')).toHaveCount(0);
});

test("Apoie oferece seleção mensal com checkout bloqueado até aprovação financeira", async ({ page }) => {
  await page.goto("/apoie");

  const modes = page.locator(".support-donation-modes");
  await expect(modes.getByRole("heading", { name: "Contribua uma vez ou todos os meses" })).toBeVisible();
  await expect(modes.getByRole("heading", { name: "Doação única por Pix" })).toBeVisible();
  await expect(modes.getByRole("heading", { name: "Doações mensais com autorização" })).toBeVisible();
  await expect(modes.getByText("Transferência externa — sem checkout no portal")).toBeVisible();
  await expect(modes.getByText("Checkout condicionado à confirmação institucional")).toBeVisible();
  await expect(modes.getByText(/até o cancelamento/)).toBeVisible();

  // Selection is a safe preview until the institution configures verified links.
  await expect(modes.locator('input[name="recurring-monthly-amount"]')).toHaveCount(3);
  await expect(modes.locator('input[name="recurring-payment-method"]')).toHaveCount(3);
  await expect(modes.locator('.support-recurring-checkout')).toBeDisabled();
  await page.locator('input[name="recurring-monthly-amount"][value="100"]').check();
  await page.getByLabel("Cartão de crédito", { exact: false }).check();
  await expect(modes.locator('.support-recurring-summary')).toContainText("100,00 por mês");
  await expect(modes.locator('.support-recurring-summary')).toContainText("Cartão de crédito");
  await expect(modes.locator('.support-recurring-checkout')).toBeDisabled();
  await page.getByLabel("Cartão de débito", { exact: false }).check();
  await expect(modes.locator('.support-recurring-status')).toContainText("indisponível");
  await expect(modes.locator('.support-recurring-checkout')).toBeDisabled();
  await expect(page.locator('main a[href*="checkout"], main a[href*="subscribe"], main a[href^="pix:"]')).toHaveCount(0);
  await expect(page.locator('main input[type="number"], main input[type="text"], main input[type="email"], main input[autocomplete^="cc-"]')).toHaveCount(0);
});

test("Portal não cria cobrança própria nem recebe webhook antes do contrato financeiro", async ({ request }) => {
  // Do not expose a fake checkout or a webhook listener without verified provider.
  const checkout = await request.post("/api/donations/checkout", {
    data: { amount: 1, frequency: "monthly" },
  });
  expect(checkout.status()).toBe(404);
  const webhook = await request.post("/api/donations/webhook", {
    data: { id: "untrusted-event", type: "paid" },
  });
  expect(webhook.status()).toBe(404);
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

test("Ícones das cinco formas de apoio ficam centralizados em seus fundos", async ({ page }) => {
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
    expect(positions).toHaveLength(5);
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
