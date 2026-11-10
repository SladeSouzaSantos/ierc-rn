import { expect, test } from "@playwright/test";
import { sortNewsNewestFirst } from "../lib/news-order";

test("news cards use publication dates, not creation or insertion order", () => {
  const records = [
    { id: "old", date: "2025-09-16" },
    { id: "new", date: "2026-11-05" },
    { id: "middle", date: "2026-08-18" },
  ];
  expect(sortNewsNewestFirst(records, item => item.date).map(item => item.id))
    .toEqual(["new", "middle", "old"]);
  expect(records.map(item => item.id)).toEqual(["old", "new", "middle"]);
});

test("missing dates appear last and equal publication dates preserve source order", () => {
  const records = [
    { id: "without-date" },
    { id: "b", date: "2026-04-15" },
    { id: "invalid", date: "not-a-date" },
    { id: "a", date: "2026-04-15" },
    { id: "newest", date: "2026-11-05T12:00:00.000Z" },
  ];
  expect(sortNewsNewestFirst(records, item => item.date).map(item => item.id))
    .toEqual(["newest", "b", "a", "without-date", "invalid"]);
});
