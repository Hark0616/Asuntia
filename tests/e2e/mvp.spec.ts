import { expect, test } from "@playwright/test";

const storageKey = "asuntia.mvp.workspace";

test.beforeEach(async ({ page }) => {
  await page.goto("/cliente");
  await page.evaluate((key) => {
    window.localStorage.removeItem(key);
  }, storageKey);
});

test("cliente entra por codigo y ve tracking vertical del asunto", async ({ page }) => {
  await page.goto("/cliente");

  await expect(page.getByRole("heading", { name: "Consulta el estado de tu asunto" })).toBeVisible();
  await page.getByTestId("tracking-code").fill("AS-2026-001");
  await page.getByTestId("open-tracking").click();

  await expect(page.getByRole("heading", { name: "Licitacion municipal 2026" })).toBeVisible();
  await expect(page.getByTestId("milestone-list")).toBeVisible();
  await expect(page.getByTestId("milestone-milestone-1")).toHaveClass(/milestone-completed/);
  await expect(page.getByTestId("milestone-milestone-3")).toHaveClass(/milestone-current/);
  await expect(page.getByText("Recoleccion de evidencia")).toBeVisible();
  await expect(
    page.getByText("Estamos esperando el certificado de experiencia actualizado"),
  ).toBeVisible();
  await expect(page.getByText("La firma habilito carga para esta etapa")).toBeVisible();

  await expect(page.getByText("Se valido la informacion inicial")).not.toBeVisible();
  await page.getByTestId("milestone-milestone-1").getByRole("button").click();
  await expect(page.getByText("Se valido la informacion inicial")).toBeVisible();

  await expect(
    page.getByText("Se revisaron los requisitos habilitantes y se identifico un documento pendiente."),
  ).toBeVisible();
  await expect(page.getByText("Certificado de experiencia", { exact: true })).toBeVisible();

  await expect(
    page.getByText("Pendiente validar internamente si conviene presentar observacion adicional."),
  ).not.toBeVisible();
});

test("firma publica avance, solicitud y documento visibles para el cliente", async ({ page }) => {
  await page.goto("/firma");
  await expect(page.getByRole("heading", { name: "Constructora Norte S.A.S." })).toBeVisible();
  await page.getByTestId("case-card-case-1").click();

  await page.getByTestId("update-body").fill("Avance visible de prueba para el cliente.");
  await page.getByTestId("update-visibility").selectOption("client");
  await page.getByTestId("publish-update").click();
  await expect(page.getByText("Avance visible de prueba para el cliente.")).toBeVisible();

  await page.getByTestId("request-title").fill("Camara de comercio actualizada");
  await page.getByTestId("request-owner").fill("Laura Mejia");
  await page.getByTestId("request-date").fill("2026-07-12");
  await page
    .getByTestId("request-detail")
    .fill("Cargar certificado con fecha de expedicion inferior a 30 dias.");
  await page.getByTestId("create-request").click();
  await expect(page.getByText("Camara de comercio actualizada")).toBeVisible();

  await page.getByTestId("document-name").fill("Camara_comercio_actualizada.pdf");
  await page.getByTestId("document-category").fill("Certificados");
  await page.getByTestId("document-visibility").selectOption("client");
  await page.getByTestId("register-document").click();
  await expect(page.getByText("Camara_comercio_actualizada.pdf")).toBeVisible();

  await page.goto("/cliente");
  await page.getByTestId("tracking-code").fill("AS-2026-001");
  await page.getByTestId("open-tracking").click();

  await expect(page.getByText("Avance visible de prueba para el cliente.")).toBeVisible();
  await expect(page.getByText("Camara de comercio actualizada")).toBeVisible();
  await expect(page.getByText("Camara_comercio_actualizada.pdf")).toBeVisible();

  await page.getByTestId("client-evidence-file").setInputFiles({
    name: "certificado_experiencia_cliente.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("demo"),
  });
  await expect(
    page.locator(".evidence-box .list-card").filter({
      hasText: "certificado_experiencia_cliente.pdf",
    }),
  ).toBeVisible();
});

test("cambio de estado y proximo paso se reflejan en el portal cliente", async ({ page }) => {
  await page.goto("/firma");
  await page.getByTestId("case-card-case-1").click();
  await page.getByTestId("case-status").selectOption("en_espera");
  await page
    .getByTestId("case-next-step")
    .fill("Esperar respuesta de la entidad antes de radicar observaciones.");
  await page.getByTestId("save-case").click();

  await page.goto("/cliente");
  await page.getByTestId("tracking-code").fill("AS-2026-001");
  await page.getByTestId("open-tracking").click();

  await expect(page.getByText("En espera")).toBeVisible();
  await expect(page.getByTestId("client-next-step")).toContainText(
    "Esperar respuesta de la entidad antes de radicar observaciones.",
  );
});
