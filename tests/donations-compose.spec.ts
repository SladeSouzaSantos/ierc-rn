import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const FILES = ["compose.portal.dev.yml", "compose.portal.prod.yml"];
const KEYS = [
  "IERCRN_DONATIONS_RECURRING_ENABLED",
  "IERCRN_DONATIONS_RECEIVER_VERIFIED",
  "IERCRN_DONATIONS_GATEWAY",
  "IERCRN_DONATIONS_RECEIVER_CNPJ",
  "IERCRN_DONATIONS_HOSTED_LINKS_JSON",
];

for (const file of FILES) {
  test(`${file}: private donation checkout config is explicitly passed to server only`, () => {
    const compose = readFileSync(path.join(process.cwd(), file), "utf8");
    for (const key of KEYS) {
      expect(compose).toContain('      ' + key + ': ${' + key + ':-');
      expect(compose).not.toContain(`NEXT_PUBLIC_${key}`);
    }
    expect(compose).toContain("IERCRN_DONATIONS_RECURRING_ENABLED: ${IERCRN_DONATIONS_RECURRING_ENABLED:-false}");
    expect(compose).toContain("IERCRN_DONATIONS_RECEIVER_VERIFIED: ${IERCRN_DONATIONS_RECEIVER_VERIFIED:-false}");
    expect(compose).not.toMatch(/(?:ACCESS_TOKEN|CARD_NUMBER|ASAAS_API_KEY):/);
  });
}
