import { expect, test } from "@playwright/test";

test("capa editorial ocupa toda a largura e arte não cobre o conteúdo", async ({ page, isMobile }) => {
  test.skip(isMobile, "Proporções da composição em duas colunas");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const layout = await page.locator(".hero-layout").boundingBox();
  const copy = await page.locator(".hero-copy").boundingBox();
  const art = await page.locator(".hero-art").boundingBox();
  if (!layout || !copy || !art) throw new Error("Hero não renderizado");
  const headline = await page.locator(".cover-headline").boundingBox();
  if (!headline) throw new Error("Título não renderizado");
  expect(headline.width / layout.width).toBeGreaterThan(0.95);
  expect(art.width / layout.width).toBeGreaterThan(0.5);
  expect(copy.x + copy.width).toBeLessThanOrEqual(art.x + 1);
  expect(headline.y + headline.height).toBeLessThanOrEqual(art.y + 1);
});

test("títulos do hero e rodapé não partem palavras nem transbordam em diferentes larguras", async ({ page }) => {
  for (const width of [320, 375, 760, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    for (const selector of [".hero h1", ".footer-identity h2"]) {
      const result = await page.locator(selector).evaluate((heading) => {
        const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
        const brokenWords: string[] = [];
        let node: Node | null = walker.nextNode();
        while (node) {
          const text = node.textContent ?? "";
          for (const match of text.matchAll(/\S+/gu)) {
            const offset = match.index ?? 0;
            const range = document.createRange();
            range.setStart(node, offset);
            range.setEnd(node, offset + match[0].length);
            const lineRects = [...range.getClientRects()].filter((rect) => rect.width > 0);
            if (lineRects.length > 1) brokenWords.push(match[0]);
          }
          node = walker.nextNode();
        }
        return {
          brokenWords,
          excessWidth: heading.scrollWidth - heading.clientWidth,
          wordBreak: getComputedStyle(heading).wordBreak,
        };
      });
      expect(result.brokenWords, `Palavras partidas em ${selector}, largura ${width}px`).toEqual([]);
      expect(result.excessWidth, `Texto transbordando em ${selector}, largura ${width}px`).toBeLessThanOrEqual(1);
      expect(result.wordBreak).toBe("normal");
    }
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(horizontalOverflow, `Página com rolagem horizontal em ${width}px`).toBeLessThanOrEqual(1);
  }
});
