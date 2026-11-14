import AxeBuilder from "@axe-core/playwright";
import { IERC_MAPS_LINK, IERC_MAPS_EMBED } from "../lib/location";
import { IERC_OFFICIAL_EMAIL, IERC_OFFICIAL_EMAIL_LINK, IERC_OFFICIAL_WHATSAPP, IERC_OFFICIAL_WHATSAPP_LINK } from "../lib/institutional-contact";
import { expect, test } from "@playwright/test";

test("instituto apresenta missão e finalidade históricas, eixos e cronologia com fontes", async ({ page }) => {
  await page.goto("/instituto");
  await expect(page.getByText("Desde 16 de julho de 1952")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Por que o IERC existe e o que busca construir" })).toBeVisible();
  const identity = page.locator(".institution-purpose");
  await expect(identity.getByRole("heading", { name: "Missão", exact: true })).toBeVisible();
  await expect(identity.getByRole("heading", { name: "Finalidade", exact: true })).toBeVisible();
  await expect(identity.getByText(/não transcrições certificadas do estatuto/)).toBeVisible();
  await expect(identity.locator("a[target='_blank']")).toHaveCount(2);
  await expect(identity.getByText(/26 de março de 2003/)).toBeVisible();
  await expect(identity.getByText(/qualificação profissional/)).toBeVisible();
  await expect(identity.getByRole("link", { name: /pesquisa sobre o estatuto/ }))
    .toHaveAttribute("href", /repositorio\.ufersa\.edu\.br/);
  const research = page.locator(".institution-research");
  await expect(research.getByRole("heading", { name: /O IERC também é feito das relações/ })).toBeVisible();
  await expect(research.locator(".institution-research-card")).toHaveCount(3);
  await expect(research.getByRole("heading", { name: /Braille e materiais criados/ })).toBeVisible();
  await expect(research.getByRole("heading", { name: /Estimulação precoce/ })).toBeVisible();
  await expect(research.getByRole("heading", { name: /Acolhimento, convivência/ })).toBeVisible();
  await expect(research.getByText(/Retrato histórico de 2024/)).toBeVisible();
  await expect(research.getByRole("link", { name: /Ler pesquisa de Vieira e Carvalho Filho/ }))
    .toHaveAttribute("rel", /noopener noreferrer/);
  await expect(page.locator(".institution-axis")).toHaveCount(4);
  for (const title of ["Educação e aprendizagem", "Autonomia e mobilidade", "Cultura e esporte", "Convivência e cidadania"]) {
    await expect(page.locator(".institution-axis").getByRole("heading", { name: title })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Uma trajetória que atravessa décadas" })).toBeVisible();
  const items = page.locator(".editorial-timeline li");
  await expect(items).toHaveCount(16);
  await expect(items.locator("a[target='_blank']")).toHaveCount(16);
  // Decades are shown as numeric intervals, not as a specific event year.
  await expect(items.locator(".timeline-year").nth(1)).toHaveText("1970–79");
  await expect(items.locator(".timeline-year").nth(4)).toHaveText("1980–89");
  for (const year of await items.locator(".timeline-year").allTextContents()) {
    expect(year).not.toMatch(/\bAnos\b/i);
  }
  const dates = await items.locator("time[datetime]").evaluateAll(nodes => nodes.map(node => node.getAttribute("datetime")));
  expect(dates).toEqual([...dates].sort());
  for (const title of [
    "Reconhecimento de utilidade pública municipal",
    "Reconhecimento de utilidade pública estadual",
    "Registro de estatuto institucional",
    "Memórias e práticas documentadas em pesquisa",
  ]) {
    await expect(items.getByRole("heading", { name: title })).toBeVisible();
  }
  await expect(items.getByText(/não comprova celebração de parceria ou repasse de recursos/)).toBeVisible();
  await expect(items.getByRole("heading", { name: "Uma nova sede no Alecrim" })).toBeVisible();
  await expect(items.getByRole("heading", { name: "Seleção municipal no paradesporto" })).toBeVisible();
  const overview = page.locator(".institution-history-prose");
  await expect(overview.locator("p")).toHaveCount(2);
  const layout = await overview.evaluate(element => {
    const paragraphs = [...element.querySelectorAll("p")];
    const first = paragraphs[0].getBoundingClientRect();
    const second = paragraphs[1].getBoundingClientRect();
    return {
      display: getComputedStyle(element).display,
      width: element.getBoundingClientRect().width,
      stacked: second.top >= first.bottom - 1,
    };
  });
  expect(layout.display).toBe("block");
  expect(layout.width).toBeLessThanOrEqual(791);
  expect(layout.stacked).toBe(true);
  await expect(items.getByText(/não comprova celebração de parceria ou repasse de recursos/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Conhecer as atividades do IERC-RN/ })).toHaveAttribute("href", "/atividades");
});

test("esporte diferencia registro público de elenco atual", async ({ page }) => {
  await page.goto("/esportes");
  await expect(page.getByRole("heading", { name: "Equipes registradas pela CBDV" })).toBeVisible();
  await expect(page.getByText("Ana Cláudia Alves de Souza Santos")).toBeVisible();
  await expect(page.getByText("Luciana Ferreira da Silva", { exact: true })).toBeVisible();
  await expect(page.locator(".sport-roster li")).toHaveCount(6);
  await expect(page.getByText(/não representam escalação atual/)).toBeVisible();
});

test("histórias apresentam trajetórias documentadas e não atribuem vínculo sem fonte", async ({ page }) => {
  await page.goto("/historias");
  await expect(page.getByRole("heading", { name: "Pessoas, caminhos e conquistas" })).toBeVisible();
  await expect(page.locator(".athlete-story")).toHaveCount(9);
  for (const name of ["Rosicleide Andrade", "Romário Marques", "Halyson Boto"]) {
    await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole("heading", { name: "Thalita Vitória Simplício", exact: true })).toBeVisible();
});

test("notícias exibem clippings de terceiros com links e datas", async ({ page }) => {
  await page.goto("/noticias");
  await expect(page.getByRole("heading", { name: "Registros publicados sobre o IERC-RN" })).toBeVisible();
  await expect(page.locator(".editorial-section:has(#clippings-title) .editorial-news")).toHaveCount(6);
  await expect(page.locator('.editorial-section:has(#clippings-title) .editorial-news a[target="_blank"]')).toHaveCount(6);
  await expect(page.getByRole("heading", {name:/IERC-RN é citado em seleção de entidades/i})).toBeVisible();
  await expect(page.getByRole("heading", {name:/Tribuna do Norte destaca autonomia/i})).toBeVisible();
  // Clippings keep their own publication date, not their insertion order.
  // Newest items must appear first regardless of when they were added to the archive.
  const dates = await page.locator(".editorial-section:has(#clippings-title) .editorial-news time[datetime]")
    .evaluateAll(nodes => nodes.map(node => node.getAttribute("datetime")));
  expect(dates).toEqual([
    "2026-11-05", "2026-08-18", "2026-07-18",
    "2026-04-15", "2026-03-27", "2025-09-16",
  ]);
  await expect(page.getByText(/Não foram criadas notícias fictícias/)).toBeVisible();
});

test("eventos arquivados não simulam agenda futura", async ({ page }) => {
  await page.goto("/eventos");
  await expect(page.locator(".editorial-event")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Próximos eventos" })).toBeVisible();
  await expect(page.getByText(/Ainda não há eventos futuros confirmados e aprovados na agenda do portal/)).toBeVisible();
});

test("contato apresenta e-mail e WhatsApp oficiais confirmados pelo IERC-RN", async ({ page }) => {
  await page.goto("/contato");
  await expect(page.locator(".verified-address")).toContainText("Rua Fonseca e Silva, 1113");
  await expect(page.getByRole("link", { name: IERC_OFFICIAL_EMAIL }).first()).toHaveAttribute("href", IERC_OFFICIAL_EMAIL_LINK);
  await expect(page.getByRole("link", { name: /Conversar com o IERC-RN/ })).toHaveAttribute("href", IERC_OFFICIAL_WHATSAPP_LINK);
  await expect(page.getByText(IERC_OFFICIAL_WHATSAPP).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Abrir no Google Maps/ })).toHaveAttribute("href", IERC_MAPS_LINK);
  await expect(page.getByRole("heading", { name: "Como chegar ao IERC-RN" })).toBeVisible();
  await expect(page.locator(".location-map iframe")).toHaveCount(0);
  await page.getByRole("button", { name: "Carregar mapa interativo" }).click();
  await expect(page.getByTitle(/Mapa interativo: IERC-RN/)).toHaveAttribute("src", IERC_MAPS_EMBED);
});

test("rodapé disponibiliza contatos oficiais em todas as páginas", async ({ page }) => {
  await page.goto("/apoie");
  const footer = page.locator("footer");
  await expect(footer.getByRole("link", { name: IERC_OFFICIAL_EMAIL })).toHaveAttribute("href", IERC_OFFICIAL_EMAIL_LINK);
  await expect(footer.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", IERC_OFFICIAL_WHATSAPP_LINK);
  await expect(page.getByText(/Terças-feiras, das 8h às 11h/)).toBeVisible();
  await expect(page.getByText(/Não há coleta domiciliar/)).toBeVisible();
});

test("visitas usa formulário oficial sem agenda paralela e sem prometer reserva", async ({ page }) => {
  await page.goto("/visitas");
  await expect(page.getByRole("heading", { name: "Solicite uma visita ao IERC-RN" })).toBeVisible();
  const link = page.getByRole("link", { name: /Solicitar agendamento de visita/ });
  await expect(link).toHaveAttribute("href", "https://forms.gle/NY35YEEkbL6HM2YF9");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
  await expect(link).toHaveAttribute("rel", /noreferrer/);
  await expect(page.getByText(/aguarde a confirmação da equipe/)).toBeVisible();
  await expect(page.getByText(/serviço externo que recebe as informações preenchidas/)).toBeVisible();
  await expect(page.locator("form, iframe")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Abrir no Google Maps/ })).toHaveAttribute("href", IERC_MAPS_LINK);
  const notice = page.locator(".visit-form-disclosure");
  await expect(notice).toBeVisible();
  const gap = await notice.evaluate(el => Number.parseFloat(window.getComputedStyle(el).marginTop));
  expect(gap).toBeGreaterThanOrEqual(24);
  await page.getByRole("button", { name: "Carregar mapa interativo" }).click();
  await expect(page.getByTitle(/Mapa interativo: IERC-RN/)).toHaveAttribute("src", IERC_MAPS_EMBED);
});

test("seções editoriais mantêm reflow e testes automáticos de acessibilidade", async ({ page }) => {
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    for (const route of ["/instituto", "/esportes", "/noticias", "/eventos", "/visitas", "/contato"]) {
      await page.goto(route);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, "Rolagem horizontal em " + route + " / " + width + "px").toBeLessThanOrEqual(1);
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const route of ["/instituto", "/esportes", "/noticias", "/visitas", "/contato"]) {
    await page.goto(route);
    const audit = await new AxeBuilder({ page }).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]).analyze();
    expect(audit.violations, "axe: " + route).toEqual([]);
  }
});

test("instituto adapta blocos históricos a telas pequenas e mantém fontes legíveis", async ({ page }) => {
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto("/instituto");
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `Rolagem horizontal na história, ${width}px`).toBeLessThanOrEqual(1);
    await expect(page.locator(".institution-purpose-card")).toHaveCount(2);
    await expect(page.locator(".institution-axis")).toHaveCount(4);
    await expect(page.locator(".editorial-timeline li")).toHaveCount(16);
    await expect(page.locator(".institution-research-card")).toHaveCount(3);
    const overview = page.locator(".institution-history-prose");
    await expect(overview.locator("p")).toHaveCount(2);
    const stacking = await overview.locator("p").evaluateAll(nodes => {
      const first = nodes[0].getBoundingClientRect();
      const second = nodes[1].getBoundingClientRect();
      return second.top >= first.bottom - 1;
    });
    expect(stacking, `Narrativa não empilhada em ${width}px`).toBe(true);
  }
});
