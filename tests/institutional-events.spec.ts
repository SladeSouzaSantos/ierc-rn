import { expect, test } from "@playwright/test";
import { groupInstitutionalEvents, institutionalEventNews, INTERNAL_EVENT_NEWS_CATEGORY } from "../lib/institutional-events";
import type { CmsArticle, CmsEvent } from "../lib/cms";

const ref = new Date("2026-11-11T18:00:00.000Z");
const event = (slug: string, startsAt: string, endsAt?: string): CmsEvent => ({
  slug, title: "Evento aprovado: " + slug,
  summary: "Programação e informações aprovadas pelo Instituto.",
  startsAt, endsAt,
});

test("agenda separates current, upcoming and completed events independently of CMS insertion order", () => {
  const raw: CmsEvent[] = [
    event("past-older", "2026-06-01T13:00:00Z"),
    event("future-later", "2026-12-15T17:00:00Z"),
    event("ongoing", "2026-11-11T17:00:00Z", "2026-11-11T19:00:00Z"),
    event("past-recent", "2026-11-10T19:00:00Z"),
    event("future-sooner", "2026-11-12T16:00:00Z"),
    event("invalid", "not-a-date"),
  ];
  const groups = groupInstitutionalEvents(raw, ref);
  expect(groups.upcoming.map(x => x.slug)).toEqual(["future-sooner", "future-later"]);
  expect(groups.ongoing.map(x => x.slug)).toEqual(["ongoing"]);
  expect(groups.completed.map(x => x.slug)).toEqual(["past-recent", "past-older"]);
  expect(raw.map(x => x.slug)[0]).toBe("past-older");
});

test("event finishing time prevents a running event from being displayed as historical", () => {
  const current = groupInstitutionalEvents([
    event("completed-by-end", "2026-11-11T17:00:00Z", "2026-11-11T17:30:00Z"),
    event("completed-with-no-end", "2026-11-11T17:00:00Z"),
    event("future", "2026-11-11T18:01:00Z"),
  ], ref);
  expect(current.ongoing).toHaveLength(0);
  expect(current.completed).toHaveLength(2);
  expect(current.upcoming).toHaveLength(1);
});

test("only expressly tagged IERC institutional articles link from the events page", () => {
  const news = (slug: string, originType: "institucional" | "externa",
    category: string, date: string): CmsArticle => ({
    slug, originType, category, date,
    title: "Atividade aprovada: " + slug,
    summary: "Registro informativo de atividade institucional do IERC-RN.",
  });
  expect(INTERNAL_EVENT_NEWS_CATEGORY).toBe("Eventos e atividades");
  const records = [
    news("comemoracao-antiga", "institucional", "Eventos e atividades", "2026-03-05"),
    news("externa", "externa", "Eventos e atividades", "2026-12-05"),
    news("comemoracao-recente", "institucional", "Evento institucional", "2026-11-10"),
    news("outras-noticias", "institucional", "Informes", "2026-11-09"),
    news("com-acentos", "institucional", "Évênto institucional", "2026-10-01"),
  ];
  expect(institutionalEventNews(records).map(x => x.slug)).toEqual([
    "comemoracao-recente", "com-acentos", "comemoracao-antiga",
  ]);
});

test("without CMS, /eventos offers a clear distinction between agenda and archived competitions", async ({ page }) => {
  if (process.env.CMS_ENABLED === "true") return;
  await page.goto("/eventos");
  await expect(page.getByRole("heading", { name: "Próximos eventos" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Notícias de eventos e atividades internas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Competições de 2026" })).toBeVisible();
  await expect(page.getByText(/Ainda não há eventos futuros confirmados e aprovados/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Ver todas as notícias do IERC-RN/ })).toHaveAttribute("href", "/noticias");
  await expect(page.locator(".editorial-event")).toHaveCount(2);
  await expect(page.locator(".editorial-section:has(#institutional-event-news-title) .editorial-news")).toHaveCount(0);
});
