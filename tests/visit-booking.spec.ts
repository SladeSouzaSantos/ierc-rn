import { expect, test } from "@playwright/test";
import { OFFICIAL_VISIT_FORM_URL, safeGoogleVisitFormUrl } from "../lib/visit-booking";

test("formulário padrão é o link oficial informado pelo IERC-RN", () => {
  expect(OFFICIAL_VISIT_FORM_URL).toBe("https://forms.gle/NY35YEEkbL6HM2YF9");
  expect(safeGoogleVisitFormUrl(OFFICIAL_VISIT_FORM_URL)).toBe(OFFICIAL_VISIT_FORM_URL);
});

test("configuração externa permite só Google Forms HTTPS e elimina parâmetros", () => {
  expect(safeGoogleVisitFormUrl(
    "https://docs.google.com/forms/d/e/1FAIpQLSdoPBs8SMr6XCy5m-85QEWyRjwvPoeROgTniAa9RObcRBVAdg/viewform?usp=send_form"
  )).toBe(
    "https://docs.google.com/forms/d/e/1FAIpQLSdoPBs8SMr6XCy5m-85QEWyRjwvPoeROgTniAa9RObcRBVAdg/viewform"
  );
  for (const value of [
    "http://forms.gle/NY35YEEkbL6HM2YF9",
    "https://forms.gle.evil.example/NY35YEEkbL6HM2YF9",
    "https://evil.example/agenda",
    "https://docs.google.com.evil.example/forms/d/e/fake/viewform",
    "https://docs.google.com/other/resource",
    "https://forms.gle@evil.example/NY35YEEkbL6HM2YF9",
    "javascript:alert(1)", "", null, 1,
  ]) expect(safeGoogleVisitFormUrl(value)).toBeNull();
});

test("formulário de visitas é um link acessível e não coleta dados no portal", async ({ page }) => {
  await page.goto("/visitas");
  const link = page.getByRole("link", { name: /Solicitar agendamento de visita/ });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", OFFICIAL_VISIT_FORM_URL);
  await expect(page.locator("form, iframe")).toHaveCount(0);
  await expect(page.getByText(/O pedido não garante a reserva/)).toBeVisible();
});
