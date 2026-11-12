import { test, expect } from "@playwright/test";
import { approvedEventImage, safeEventUploadPath } from "../lib/event-media";

const photo = { url: "/uploads/convite_natalino_2026_a1b2c3.webp", mime: "image/webp" };
const approved = {
  title: "Festa Natalina do IERC-RN",
  image: photo,
  imageRightsStatus: "autorizado",
  imageAlt: "Convite da Festa Natalina de 2026 do IERC-RN.",
  imageCredit: "IERC-RN",
};

test("a imagem só entra no cartão com autorização e texto alternativo", () => {
  expect(approvedEventImage(approved)).toEqual({
    path: photo.url,
    alt: approved.imageAlt,
    credit: "IERC-RN",
  });
  expect(approvedEventImage({ ...approved, imageRightsStatus: "pendente" })).toBeNull();
  expect(approvedEventImage({ ...approved, imageRightsStatus: "restrito" })).toBeNull();
  expect(approvedEventImage({ ...approved, imageAlt: "" })).toBeNull();
  expect(approvedEventImage({ ...approved, image: null })).toBeNull();
  expect(approvedEventImage({ ...approved, image: { ...photo, mime: "image/svg+xml" } })).toBeNull();
  expect(approvedEventImage({ ...approved, image: { ...photo, url: "/uploads/documento.pdf" } })).toBeNull();
});

test("mídia populada em formato Strapi v4 também é validada", () => {
  expect(approvedEventImage({
    ...approved,
    image: { data: { attributes: photo } },
  })?.path).toBe(photo.url);
});

test("URLs remotas, traversal e formatos perigosos nunca são usados", () => {
  for (const value of [
    "http://cms:1337/uploads/foto.png",
    "https://outro-site.example/uploads/foto.png",
    "/uploads/../../etc/passwd.png",
    "/uploads/%2e%2e/secret.webp",
    "/uploads/foto.svg",
    "/uploads/foto.png?download=1",
    "//example.com/uploads/foto.png",
    "/uploads/a//b.webp",
    "", null, 123,
  ]) {
    expect(safeEventUploadPath(value)).toBeNull();
  }
  expect(safeEventUploadPath("/uploads/convite_natalino_abc123.webp"))
    .toBe("/uploads/convite_natalino_abc123.webp");
});

test("eventos sem mídia continuam renderizáveis no portal", async ({ page }) => {
  await page.goto("/eventos");
  const cards = page.locator(".cms-events-list .editorial-event-card");
  // CI uses no live CMS credentials. The empty state and historical archive
  // must remain functional instead of showing broken image placeholders.
  await expect(page.getByRole("heading", { name: "Próximos eventos" })).toBeVisible();
  await expect(cards).toHaveCount(0);
  await expect(page.locator(".editorial-event-media img")).toHaveCount(0);
});

test("o bloco Eventos apresenta separação legível entre grupos", async ({ page }) => {
  await page.goto("/eventos");
  const headings = page.locator(".cms-events-list .event-group > h3");
  await expect(headings.first()).toHaveText("Próximos eventos");
  const gap = await page.locator(".cms-events-list .event-group").first().evaluate(el =>
    Number.parseFloat(getComputedStyle(el).marginTop));
  expect(gap).toBeGreaterThanOrEqual(32);
  await page.setViewportSize({ width: 375, height: 800 });
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});


test("cartão com imagem mantém o convite ao lado em desktop e reflow no celular", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/eventos");
  await page.locator(".cms-events-list .event-group").first().evaluate(section => {
    // Fixture local: CI não tem token do CMS e não deve depender de mídia publicada.
    const panel = document.createElement("div");
    panel.className = "editorial-panels";
    panel.innerHTML = `
      <article class="detail-card editorial-event editorial-event-card editorial-event-card--with-image">
        <figure class="editorial-event-media">
          <img alt="Convite de evento para testes" width="200" height="300"
               src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=">
          <figcaption>Imagem: IERC-RN</figcaption>
        </figure>
        <div class="editorial-event-content">
          <span class="editorial-event-date">13 de dezembro</span>
          <h4>Festa Natalina 2026</h4>
          <p>Evento institucional aprovado e publicado.</p>
        </div>
      </article>
      <article class="detail-card editorial-event editorial-event-card">
        <div class="editorial-event-content"><h4>Evento sem imagem</h4></div>
      </article>`;
    section.append(panel);
  });

  const illustrated = page.locator(".cms-events-list .editorial-event-card--with-image");
  const unillustrated = page.locator(".cms-events-list .editorial-event-card:not(.editorial-event-card--with-image)");
  await expect(illustrated).toHaveCSS("display", "grid");
  await expect(unillustrated).toHaveCSS("display", "flex");
  const desktop = await illustrated.evaluate(card => {
    const media = card.querySelector(".editorial-event-media")!.getBoundingClientRect();
    const content = card.querySelector(".editorial-event-content")!.getBoundingClientRect();
    return { mediaRight: media.right, contentLeft: content.left, mediaTop: media.top, contentTop: content.top };
  });
  expect(desktop.mediaRight).toBeLessThanOrEqual(desktop.contentLeft + 1);
  expect(Math.abs(desktop.mediaTop - desktop.contentTop)).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 375, height: 800 });
  const mobile = await illustrated.evaluate(card => {
    const media = card.querySelector(".editorial-event-media")!.getBoundingClientRect();
    const content = card.querySelector(".editorial-event-content")!.getBoundingClientRect();
    return { mediaBottom: media.bottom, contentTop: content.top };
  });
  expect(mobile.mediaBottom).toBeLessThanOrEqual(mobile.contentTop + 1);
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
