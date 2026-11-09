import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("nove trajetórias verificadas aparecem com fontes oficiais e vínculo contextual", async ({ page }) => {
  await page.goto("/historias");
  const expected = [
    "Thalita Vitória Simplício",
    "Clara Daniele Barros da Silva",
    "Sharlley Anthony do Nascimento Silva",
    "Geovana Clara Costa de Moura",
    "Maria Clara Nascimento",
    "Amanda Emilly Fernandes de Santana",
    "Israele Letícia Pereira Gomes",
    "Luciana Ferreira da Silva",
    "Lucas Araken Silva de Araújo",
  ];
  const profiles = page.locator(".athlete-story");
  await expect(profiles).toHaveCount(expected.length);
  for (const name of expected) {
    await expect(profiles.getByRole("heading", { name, exact: true })).toHaveCount(1);
  }
  for (const profile of await profiles.all()) {
    await expect(profile.locator(".athlete-story-relation")).toBeVisible();
    await expect(profile.locator(".athlete-story-sources a").first()).toHaveAttribute("target", "_blank");
    await expect(profile.locator(".athlete-story-sources a").first()).toHaveAttribute("rel", /noopener/);
  }
});

test("fotografias identificadas têm descrição, crédito e status editorial transparente", async ({ page }) => {
  await page.goto("/historias");
  const photos = page.locator(".athlete-story-frame img");
  await expect(photos).toHaveCount(4);
  for (const img of await photos.all()) {
    const alt = await img.getAttribute("alt");
    expect(alt?.trim().length).toBeGreaterThan(30);
    await expect(img).toHaveAttribute("src", /^https:\/\//);
  }
  await expect(page.locator(".athlete-photo-credit")).toHaveCount(4);
  await expect(page.getByText("Retrato individual em verificação")).toHaveCount(5);
  await expect(page.getByText(/licença de reprodução no portal ainda precisa ser autorizada/)).toBeVisible();
  await expect(page.locator('.athlete-photo-credit a[target="_blank"]')).toHaveCount(4);
  await expect(page.locator(".athlete-photo-pending")).toHaveCount(5);
});

test("não há representação não comprovada de outros atletas como ex-alunos do IERC", async ({ page }) => {
  await page.goto("/historias");
  for (const name of ["Rosicleide Andrade", "Romário Marques", "Halyson Boto"]) {
    await expect(page.locator(".athlete-story").getByRole("heading", { name, exact: true })).toHaveCount(0);
  }
  await expect(page.locator("#geovana-moura")).toContainText("2016");
  await expect(page.locator("#sharlley-anthony")).toContainText("2018");
  await expect(page.locator("#amanda-emilly-santana")).toContainText("2017");
  await expect(page.locator("#israele-leticia")).toContainText("2019");
  await expect(page.locator("#luciana-ferreira")).toContainText("2026");
  await expect(page.locator("#lucas-araken")).toContainText("11 anos");
});

test("cartões de atletas não produzem overflow horizontal em telas estreitas", async ({ page }) => {
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/historias");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "Rolagem horizontal em " + width + "px").toBeLessThanOrEqual(1);
  }
});

test("histórias passam pela auditoria automática WCAG A/AA e preservam imagens textuais", async ({ page }) => {
  await page.goto("/historias");
  const report = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(report.violations).toEqual([]);
});

test("imagem de Thalita aponta para a foto oficial correta e não para a atleta Carol Santiago", async ({ page }) => {
  await page.goto("/historias");
  const card = page.locator("#thalita-simplicio");
  const image = card.locator(".athlete-story-frame img");
  await expect(image).toHaveAttribute("src", /\/thalita-simplicio\\.jpg\/@@images\/5f256ce8-17de-4b9d-9be5-a12072d0e112\\.jpeg$/);
  await expect(card.locator(".athlete-photo-credit")).toContainText("Alexandre Schneider/CPB");
  await expect(image).not.toHaveAttribute("src", /maria-carolina/);
});
