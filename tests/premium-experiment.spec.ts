import { expect, test } from "@playwright/test";

const routes = [
  ["/", "home"],
  ["/instituto", "instituto"],
  ["/atividades", "atividades"],
  ["/esportes", "esportes"],
  ["/historias", "historias"],
  ["/noticias", "noticias"],
  ["/eventos", "eventos"],
  ["/galeria", "galeria"],
  ["/visitas", "visitas"],
  ["/apoie", "apoie"],
  ["/contato", "contato"],
  ["/radar-da-inclusao", "radar"],
] as const;

for (const [route, variant] of routes) {
  test(`premium: ${route} — estrutura, reflow e captura de referência`, async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const response = await page.goto(route);
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (route !== "/") {
      await expect(page.locator(".interior-hero")).toHaveAttribute("data-editorial-variant", variant);
    }
    await page.screenshot({ path: testInfo.outputPath(`premium-${variant}.png`), fullPage: true, animations: "disabled", timeout: 20_000 });
    await page.setViewportSize({ width: 320, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}

test("beyond: cinco capítulos, créditos e conteúdo essencial disponível", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-ui-experiment","beyond-v4");
  await expect(page.getByRole("heading",{level:1,name:"Além do olhar."})).toBeVisible();
  await expect(page.locator(".beyond-act")).toHaveCount(5);
  await expect(page.getByRole("navigation",{name:"Explore a página inicial"}).getByRole("link")).toHaveCount(4);
  await expect(page.locator(".beyond-collage [data-beyond-layer]")).toHaveCount(3);
  await expect(page.locator(".heritage-year strong")).toHaveText("1952");
  await expect(page.locator(".activity-card")).toHaveCount(8);
  await expect(page.locator(".beyond-credits li")).toHaveCount(5);
  await expect(page.getByText(/Fotografias ilustrativas externas, não registros do IERC-RN/)).toBeVisible();
  for(const image of await page.locator(".beyond-photo img").all()){
    await image.scrollIntoViewIfNeeded();
    await expect.poll(()=>image.evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
});

test("beyond: cena fotográfica acompanha scroll e retorna ao estático", async ({page,isMobile})=>{
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.goto("/");
  const root=page.locator(".beyond-home");
  const center=page.locator('[data-beyond-layer="center"]');
  if(!isMobile && (page.viewportSize()?.width??0)>=1024 && (page.viewportSize()?.height??0)>=640){
    await expect(root).toHaveAttribute("data-story-motion","active");
    const before=await center.evaluate(el=>getComputedStyle(el).transform);
    await page.evaluate(()=>window.scrollTo(0,500));
    await expect.poll(()=>center.evaluate(el=>getComputedStyle(el).transform)).not.toBe(before);
  }
  await page.getByRole("button",{name:"Acessibilidade",exact:true}).click();
  await page.getByRole("checkbox",{name:"Reduzir animações"}).check();
  await expect(root).toHaveAttribute("data-story-motion","static");
  await expect(center).toHaveCSS("transform","none");
  await page.getByRole("checkbox",{name:"Alto contraste"}).check();
  await expect(page.locator(".beyond-cover")).toHaveCSS("background-color","rgb(0, 0, 0)");
});

test("beyond: conteúdo essencial sem JavaScript e com movimento reduzido",async({browser})=>{
  const context=await browser.newContext({baseURL:"http://127.0.0.1:3000",javaScriptEnabled:false,reducedMotion:"reduce",viewport:{width:390,height:900}});
  try{
    const page=await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading",{level:1})).toBeVisible();
    await expect(page.getByRole("link",{name:"Conheça o Instituto"}).first()).toBeVisible();
    await expect(page.getByRole("link",{name:"Conheça o bazar"})).toHaveAttribute("href","/apoie");
  }finally{await context.close();}
});

test("premium: página de erro mantém recuperação acessível", async ({page})=>{
  const response=await page.goto("/noticias/rascunho-nao-aprovado");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading",{level:1})).toBeVisible();
  await expect(page.getByRole("link",{name:"Voltar ao início"})).toHaveAttribute("href","/");
});

test("beyond: capturas desktop, tablet e celular",async({page,isMobile},testInfo)=>{
  test.skip(isMobile,"Projeto desktop reproduz as três larguras.");
  test.setTimeout(60_000);
  await page.emulateMedia({reducedMotion:"reduce"});
  for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:900});
    await page.goto("/");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({path:testInfo.outputPath(`beyond-cover-${width}.png`),animations:"disabled"});
  }
});
