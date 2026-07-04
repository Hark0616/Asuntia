import { expect, test } from "@playwright/test";

const storageKey = "asuntia.mvp.workspace";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    window.localStorage.removeItem(key);
  }, storageKey);
  await page.goto("/");
});

test("cliente entra por busqueda y ve sus casos asociados", async ({ page }) => {
  await page.getByTestId("mode-client").click();

  await expect(page.getByRole("heading", { name: "Portal cliente" })).toBeVisible();
  await page.getByTestId("client-search").fill("Laura");
  await page.getByTestId("client-result-client-1").click();

  await expect(page.getByRole("heading", { name: "Constructora Norte S.A.S." })).toBeVisible();
  await expect(page.getByText("Mis casos")).toBeVisible();
  await expect(page.getByTestId("case-card-case-1")).toContainText(
    "Licitacion municipal 2026",
  );
  await expect(page.getByTestId("case-card-case-2")).toContainText(
    "Contrato de obra con proveedor",
  );
  await expect(page.getByText("Proximo paso")).toBeVisible();
  await expect(
    page.getByText("Se revisaron los requisitos habilitantes y se identifico un documento pendiente."),
  ).toBeVisible();
  await expect(page.getByText("Certificado de experiencia", { exact: true })).toBeVisible();

  await expect(
    page.getByText("Pendiente validar internamente si conviene presentar observacion adicional."),
  ).not.toBeVisible();
});

test("firma publica avance, solicitud y documento visibles para el cliente", async ({ page }) => {
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

  await page.getByTestId("mode-client").click();
  await page.getByTestId("client-result-client-1").click();

  await expect(page.getByText("Avance visible de prueba para el cliente.")).toBeVisible();
  await expect(page.getByText("Camara de comercio actualizada")).toBeVisible();
  await expect(page.getByText("Camara_comercio_actualizada.pdf")).toBeVisible();
});

test("cambio de estado y proximo paso se reflejan en el portal cliente", async ({ page }) => {
  await page.getByTestId("case-card-case-1").click();
  await page.getByTestId("case-status").selectOption("en_espera");
  await page
    .getByTestId("case-next-step")
    .fill("Esperar respuesta de la entidad antes de radicar observaciones.");
  await page.getByTestId("save-case").click();

  await page.getByTestId("mode-client").click();
  await page.getByTestId("client-result-client-1").click();

  await expect(page.getByTestId("case-card-case-1")).toContainText("En espera");
  await expect(page.getByTestId("case-card-case-1")).toContainText(
    "Esperar respuesta de la entidad antes de radicar observaciones.",
  );
});
