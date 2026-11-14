import { test, expect } from "@playwright/test";
import { approvedCmsQuery, approvedPublishedRecord } from "../lib/cms-policy";

test("CMS query contract prevents draft and approval-filter overrides", () => {
  const q = approvedCmsQuery({ "filters[slug][$eq]": "publicado" });
  expect(q.get("status")).toBe("published");
  expect(q.get("filters[editorialStatus][$eq]")).toBe("aprovado");
  expect(q.get("filters[slug][$eq]")).toBe("publicado");
  for (const key of ["status", "filters[editorialStatus][$eq]", "pagination[pageSize]"]) {
    expect(() => approvedCmsQuery({ [key]: "draft" })).toThrow(/policy override/);
  }
});
test("CMS response policy fails closed even when upstream filters are bypassed", () => {
  const publishedAt = "2026-11-14T12:00:00.000Z";
  expect(approvedPublishedRecord({ editorialStatus: "aprovado", publishedAt })).toBe(true);
  for (const record of [
    { editorialStatus: "em_revisao", publishedAt },
    { editorialStatus: "aprovado", publishedAt: null },
    { editorialStatus: "aprovado", publishedAt: "invalid" },
    null, [], {},
  ]) expect(approvedPublishedRecord(record)).toBe(false);
});
