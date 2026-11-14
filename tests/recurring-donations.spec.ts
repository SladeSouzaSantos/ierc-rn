import { expect, test } from "@playwright/test";
import {
  DONATION_MONTHLY_AMOUNTS,
  resolveRecurringDonationConfig,
  safeHostedCheckoutUrl,
} from "../lib/recurring-donations";

const legitimate = {
  IERCRN_DONATIONS_RECURRING_ENABLED: "true",
  IERCRN_DONATIONS_RECEIVER_VERIFIED: "true",
  IERCRN_DONATIONS_GATEWAY: "asaas",
  IERCRN_DONATIONS_RECEIVER_CNPJ: "08049504000108",
  IERCRN_DONATIONS_HOSTED_LINKS_JSON: JSON.stringify({
    pix: { "20": "https://www.asaas.com/c/12345678910" },
    credit: { "20": "https://www.asaas.com/000/c/56789012345",
              "100": "https://www.asaas.com/000/c/56789012346" },
  }),
};

test("hosted recurring checkout remains disabled unless institution confirms receiver and provider", () => {
  for (const key of [
    "IERCRN_DONATIONS_RECURRING_ENABLED",
    "IERCRN_DONATIONS_RECEIVER_VERIFIED",
    "IERCRN_DONATIONS_GATEWAY",
    "IERCRN_DONATIONS_RECEIVER_CNPJ",
    "IERCRN_DONATIONS_HOSTED_LINKS_JSON",
  ] as const) {
    const env = { ...legitimate, [key]: undefined };
    const config = resolveRecurringDonationConfig(env);
    expect(config.enabled).toBe(false);
    expect(config.links).toEqual({ pix: {}, credit: {} });
  }
  expect(resolveRecurringDonationConfig(legitimate)).toEqual({
    enabled: true,
    links: {
      pix: { 20: "https://www.asaas.com/c/12345678910" },
      credit: {
        20: "https://www.asaas.com/000/c/56789012345",
        100: "https://www.asaas.com/000/c/56789012346",
      },
    },
  });
});

test("recurring link validator handles new 2026 Asaas public URL form and rejects redirection attacks", () => {
  expect(safeHostedCheckoutUrl("https://www.asaas.com/c/12345678910")).toBe(
    "https://www.asaas.com/c/12345678910",
  );
  expect(safeHostedCheckoutUrl("https://www.asaas.com/000/c/12345678910")).toBe(
    "https://www.asaas.com/000/c/12345678910",
  );
  const malicious = [
    "https://www.asaas.com.evil.example/c/123",
    "https://www.asaas.com@evil.example/c/123",
    "https://evil.example/c/123",
    "https://asaas.com/c/123",
    "http://www.asaas.com/c/123",
    "javascript:alert(1)",
    "https://www.asaas.com:8443/c/123",
    "https://www.asaas.com/c/123?redirect=https://attacker.example",
    "https://www.asaas.com/c/123#frag",
    "https://www.asaas.com/",
    "https://www.asaas.com/c/%2e%2e/evil",
  ];
  for (const value of malicious) expect(
    safeHostedCheckoutUrl(value),
    `Unsafe URL was accepted: ${value}`,
  ).toBeNull();
});

test("malformed provider config and links fail entirely closed without partial checkout", () => {
  const invalidConfigs = [
    '{"pix":{"20":"https://evil.example/steal"}}',
    '{"pix":{"20":"https://www.asaas.com/c/valid"},"debit":{"20":"https://www.asaas.com/c/invalid"}}',
    '{"credit":{"35":"https://www.asaas.com/c/invalid"}}',
    '{"pix":{"20":"https://www.asaas.com/c/valid"},"credit":{"50":"http://www.asaas.com/c/insecure"}}',
    '{"credit":[]}',
    'not JSON',
    JSON.stringify({ pix: { "20": "https://www.asaas.com/c/valid" }, extra: true }),
  ];
  for (const str of invalidConfigs) {
    const result = resolveRecurringDonationConfig({
      ...legitimate, IERCRN_DONATIONS_HOSTED_LINKS_JSON: str,
    });
    expect(result.enabled).toBe(false);
    expect(result.links).toEqual({ pix: {}, credit: {} });
  }
  expect(DONATION_MONTHLY_AMOUNTS).toEqual([20, 50, 100]);
});

test("accessible monthly flow exposes amount/payment method and cancellation information", async ({ page }) => {
  await page.goto("/apoie");
  const panel = page.locator(".support-recurring");
  await expect(panel.getByRole("heading", { name: "Quero apoiar todos os meses" })).toBeVisible();
  await expect(panel.getByRole("group", { name: "Valor da contribuição mensal" })).toBeVisible();
  await expect(panel.getByRole("group", { name: "Forma de pagamento" })).toBeVisible();
  await expect(panel.getByText(/Pix Automático, com débito sem nova confirmação/)).toBeVisible();
  await expect(panel.getByText(/Para solicitar encerramento ou esclarecimentos/)).toBeVisible();
  await expect(panel.getByText(/página do provedor/)).toBeVisible();
  await expect(panel.locator("input[autocomplete^='cc-'], input[type='number']")).toHaveCount(0);
  await expect(panel.locator("a[href^='https://']")).toHaveCount(0);
  await expect(panel.locator(".support-recurring-checkout")).toBeDisabled();
});
