import { expect, test, type Page } from "@playwright/test";

const storageKey = "asuntia.mvp.workspace";

async function waitForWorkspaceSave(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.url().includes("/api/workspace") &&
      response.request().method() === "PUT" &&
      response.ok(),
  );
}

test.beforeEach(async ({ page, request }) => {
  const reset = await request.delete("/api/workspace");
  expect(reset.ok()).toBeTruthy();

  await page.goto("/");
  await page.evaluate((key) => {
    window.localStorage.removeItem(key);
    window.sessionStorage.clear();
  }, storageKey);
});

test("cliente entra desde la pagina principal con codigo y captcha", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Consultar asunto" })).toBeVisible();
  await expect(page.getByTestId("home-login")).toContainText("Iniciar sesión");
  await page.getByTestId("public-tracking-code").fill("AS-2026-001");
  await page.getByTestId("captcha-answer").fill("10");
  await page.getByTestId("public-search").click();

  await expect(page.getByRole("heading", { name: "Licitacion municipal 2026" })).toBeVisible();
  await expect(page).toHaveURL(/\/cliente\?codigo=AS-2026-001/);
  await expect(page.getByTestId("milestone-list")).toBeVisible();
  await expect(page.getByTestId("milestone-milestone-1")).toHaveClass(/milestone-completed/);
  await expect(page.getByTestId("milestone-milestone-3")).toHaveClass(/milestone-current/);
  await expect(page.getByText("Recoleccion de evidencia")).toBeVisible();
  await expect(
    page.getByText("Estamos esperando el certificado de experiencia actualizado"),
  ).toBeVisible();
  await expect(page.getByTestId("client-action-card")).toContainText("Certificado de experiencia");
  await expect(page.getByText("Sube el documento solicitado")).toBeVisible();

  await expect(page.getByText("Se valido la informacion inicial")).not.toBeVisible();
  await page.getByTestId("milestone-milestone-1").getByRole("button").click();
  await expect(page.getByText("Se valido la informacion inicial")).toBeVisible();

  await expect(
    page.getByText("Se revisaron los requisitos habilitantes y se identifico un documento pendiente."),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary").getByText("Certificado de experiencia", { exact: true }),
  ).toBeVisible();

  await expect(
    page.getByText("Pendiente validar internamente si conviene presentar observacion adicional."),
  ).not.toBeVisible();
});

test("cliente sin codigo vuelve a la entrada principal", async ({ page }) => {
  await page.goto("/cliente");

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Consultar asunto" })).toBeVisible();
});

test("firma publica avance, solicitud y documento visibles para el cliente", async ({ page }) => {
  await page.goto("/firma");
  await expect(page.getByRole("heading", { name: "Constructora Norte S.A.S." })).toBeVisible();
  await page.getByTestId("case-card-case-1").click();

  await page.getByTestId("update-body").fill("Avance visible de prueba para el cliente.");
  await page.getByTestId("update-visibility").selectOption("client");
  const updateSaved = waitForWorkspaceSave(page);
  await page.getByTestId("publish-update").click();
  await updateSaved;
  await expect(page.getByText("Avance visible de prueba para el cliente.")).toBeVisible();

  await page.getByTestId("request-title").fill("Camara de comercio actualizada");
  await page.getByTestId("request-owner").fill("Laura Mejia");
  await page.getByTestId("request-date").fill("2026-07-12");
  await page
    .getByTestId("request-detail")
    .fill("Cargar certificado con fecha de expedicion inferior a 30 dias.");
  const requestSaved = waitForWorkspaceSave(page);
  await page.getByTestId("create-request").click();
  await requestSaved;
  await expect(page.getByText("Camara de comercio actualizada")).toBeVisible();

  await page.getByTestId("document-name").fill("Camara_comercio_actualizada.pdf");
  await page.getByTestId("document-category").fill("Certificados");
  await page.getByTestId("document-visibility").selectOption("client");
  const documentSaved = waitForWorkspaceSave(page);
  await page.getByTestId("register-document").click();
  await documentSaved;
  await expect(page.getByText("Camara_comercio_actualizada.pdf")).toBeVisible();

  await page.goto("/");
  await page.getByTestId("public-tracking-code").fill("AS-2026-001");
  await page.getByTestId("captcha-answer").fill("10");
  await page.getByTestId("public-search").click();

  await expect(page.getByText("Avance visible de prueba para el cliente.")).toBeVisible();
  await expect(page.getByText("Camara de comercio actualizada")).toBeVisible();
  await expect(page.getByText("Camara_comercio_actualizada.pdf")).toBeVisible();

  await page.getByTestId("client-evidence-file").setInputFiles({
    name: "certificado_experiencia_cliente.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("demo"),
  });
  await expect(
    page.locator(".evidence-box .badge.neutral").filter({
      hasText: "certificado_experiencia_cliente.pdf",
    }),
  ).toBeVisible();
  const evidenceSaved = waitForWorkspaceSave(page);
  await page.getByTestId("send-evidence").click();
  await evidenceSaved;
  await expect(page.getByText("Recibido por la firma")).toBeVisible();
  await expect(
    page.locator(".evidence-box .list-card").filter({
      hasText: "certificado_experiencia_cliente.pdf",
    }),
  ).toBeVisible();
});

test("cambio de estado y proximo paso se reflejan en el portal cliente", async ({ page }) => {
  await page.goto("/firma");
  await page.getByTestId("case-card-case-1").click();
  const statusSaved = waitForWorkspaceSave(page);
  await page.getByTestId("case-status").selectOption("en_espera");
  await statusSaved;
  await page
    .getByTestId("case-next-step")
    .fill("Esperar respuesta de la entidad antes de radicar observaciones.");
  const caseSaved = waitForWorkspaceSave(page);
  await page.getByTestId("save-case").click();
  await caseSaved;

  await page.goto("/");
  await page.getByTestId("public-tracking-code").fill("AS-2026-001");
  await page.getByTestId("captcha-answer").fill("10");
  await page.getByTestId("public-search").click();

  await expect(page.getByText("En espera")).toBeVisible();
  await expect(page.getByTestId("client-next-step")).toContainText(
    "Esperar respuesta de la entidad antes de radicar observaciones.",
  );
});
