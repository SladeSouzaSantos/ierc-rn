import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("capa fotográfica possui identificação ilustrativa e alternativas de texto",async({page})=>{
  await page.goto("/");
  await expect(page.getByRole("heading",{level:1})).toHaveText("Além do olhar.");
  await expect(page.locator(".beyond-thesis")).toContainText("abrir possibilidades");
  await expect(page.locator(".beyond-collage .beyond-photo")).toHaveCount(3);
  for(const img of await page.locator(".beyond-collage img").all())await expect(img).not.toHaveAttribute("alt","");
});

test("bloco de goalball inclui imagem de quadra e bola sonora meramente decorativa", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /O som da bola/ })).toBeVisible();
  const illustration = page.locator(".sport-art");
  await expect(illustration).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".sport-copy")).toContainText("O goalball faz parte da vida esportiva");
  const image = illustration.locator(".sport-art-illustration");
  // Next/Image carrega imagens abaixo da dobra sob demanda: simular rolagem real.
  await image.scrollIntoViewIfNeeded();
  await expect(image).toHaveAttribute("alt", "");
  await expect(image).toHaveAttribute("src", "/illustrations/goalball-quadra.svg");
  await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});

test("os SVGs são locais, legíveis e não carregam scripts externos", async ({ request }) => {
  for (const resource of ["/illustrations/leitura-tatil.svg", "/illustrations/goalball-quadra.svg"]) {
    const response = await request.get(resource);
    expect(response.ok(), resource).toBeTruthy();
    const content = await response.text();
    expect(content).toContain("<svg");
    expect(content).toContain("</svg>");
    expect(content).not.toMatch(/<script|<foreignObject|(?:href|src)\s*=\s*["\x27]https?:/i);
  }
});

test("artes mantêm layout sem rolagem horizontal em tela estreita", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await expect(page.locator(".beyond-collage")).toBeVisible();
  await expect(page.locator(".sport-art-illustration")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("capa móvel mantém três camadas e não causa overflow",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  for(const width of [320,375,600,760]){
    await page.setViewportSize({width,height:900});
    await page.goto("/");
    await expect(page.locator(".beyond-home")).toHaveAttribute("data-story-motion","static");
    await expect(page.locator(".beyond-collage [data-beyond-layer]")).toHaveCount(3);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  }
});

test("homepage redesenhada continua sem violações automatizadas axe-core A/AA", async ({ page }) => {
  await page.goto("/");
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"])
    .analyze();
  expect(result.violations).toEqual([]);
});

test("goalball mantém proporções e acesso ao conteúdo",async({page,isMobile})=>{
  test.skip(isMobile,"Composição desktop");
  await page.setViewportSize({width:1440,height:900});
  await page.goto("/");
  const sport=await page.locator(".sport-art").boundingBox();
  if(!sport)throw new Error("Arte de goalball não encontrada");
  expect(sport.width/sport.height).toBeGreaterThan(1.25);
  await expect(page.getByRole("link",{name:"Conheça o Instituto"}).first()).toBeVisible();
});
