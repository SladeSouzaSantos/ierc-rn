import { expect, test } from "@playwright/test";

/**
 * Simula um atributo inserido por extensão do navegador ANTES da hidratação.
 * O HTML é alterado na resposta, não por React. Assim reproduzimos o padrão
 * observado com cz-shortcut-listen no <body> sem instalar a extensão no CI.
 */
test("extensão injetando atributo no body não causa aviso de hidratação", async ({ page }) => {
  const hydrationErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error" && /hydrat|cz-shortcut-listen/i.test(message.text())) {
      hydrationErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    if (/hydrat|cz-shortcut-listen/i.test(error.message)) {
      hydrationErrors.push(error.message);
    }
  });

  await page.route("**/eventos", async (route) => {
    if (!route.request().isNavigationRequest()) return route.continue();

    const response = await route.fetch();
    const original = await response.text();
    const altered = original.replace(/<body(\s|>)/i, '<body cz-shortcut-listen="true"$1');

    // Se o seletor não encontrar <body>, não damos falso positivo ao teste.
    expect(altered).not.toBe(original);
    const headers = { ...response.headers() };
    delete headers["content-length"];
    delete headers["content-encoding"];
    await route.fulfill({ response, body: altered, headers });
  });

  await page.goto("/eventos");
  await expect(page.getByRole("heading", { name: "Eventos", level: 1 })).toBeVisible();
  const button = page.getByRole("button", { name: "Acessibilidade", exact: true });
  await button.click();
  await expect(page.getByRole("heading", { name: "Preferências de acessibilidade" })).toBeVisible();
  expect(hydrationErrors).toEqual([]);
});
