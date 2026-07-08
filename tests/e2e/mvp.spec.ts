import { expect, test, type Page } from "@playwright/test";

const storageKey = "asuntia.mvp.workspace";
const firmPassword = "AsuntiaDemo2026!";

async function loginFirm(page: Page, email = "socia@asuntia.local") {
  await page.goto("/firma/login");
  await page.getByTestId("firm-email").fill(email);
  await page.getByTestId("firm-password").fill(firmPassword);
  await page.getByTestId("firm-login").click();
  await expect(page).toHaveURL("/firma");
  await expect(page.getByRole("heading", { name: "Constructora Norte S.A.S." })).toBeVisible();
}

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

test("pagina principal muestra la landing publica de la firma", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Insolvencia con estrategia, orden y seguimiento claro",
    }),
  ).toBeVisible();
  await expect(page.getByText("Derecho de la insolvencia").first()).toBeVisible();
  await expect(page.getByTestId("landing-consult-cta")).toHaveAttribute("href", "/consulta");
  await expect(
    page.getByRole("heading", { exact: true, name: "Persona natural no comerciante" }),
  ).toBeVisible();
  await expect(
    page.locator("#guias").getByRole("heading", {
      name: "Preparar documentos antes de iniciar una insolvencia",
    }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Guias" }).click();
  await expect(page).toHaveURL(/#guias/);
  await expect(
    page.getByRole("heading", { name: "Guias rapidas para llegar con informacion ordenada" }),
  ).toBeVisible();

  await page.getByTestId("landing-consult-cta").click();
  await expect(page).toHaveURL("/consulta");
  await expect(page.getByRole("heading", { name: "Consulta el estado de tu proceso" })).toBeVisible();
});

test("cliente entra desde consulta con codigo y captcha", async ({ page }) => {
  await page.goto("/consulta");

  await expect(page.getByRole("heading", { name: "Consulta el estado de tu proceso" })).toBeVisible();
  await expect(page.getByTestId("home-login")).toContainText("Acceso firma");
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
    page.getByTestId("client-action-card").getByRole("heading", {
      name: "Certificado de experiencia",
    }),
  ).toBeVisible();

  await expect(
    page.getByText("Pendiente validar internamente si conviene presentar observacion adicional."),
  ).not.toBeVisible();
});

test("guia publica renderiza detalle, area y relacionadas", async ({ page }) => {
  const response = await page.goto("/guias/documentos-antes-de-insolvencia");

  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", {
      name: "Preparar documentos antes de iniciar una insolvencia",
    }),
  ).toBeVisible();
  await expect(page.getByText("Empresa en reorganizacion").first()).toBeVisible();
  await expect(page.getByText("Esta guia es informativa")).toBeVisible();
  await expect(
    page.locator(".guide-cta-panel").getByRole("link", { name: /Consulta tu caso/ }),
  ).toHaveAttribute(
    "href",
    "/consulta",
  );
  await expect(
    page.getByRole("heading", {
      name: "Flujo de caja en una reorganizacion empresarial",
    }),
  ).toBeVisible();
});

test("guias inexistentes o no publicadas devuelven not found", async ({ page }) => {
  const missing = await page.goto("/guias/no-existe");
  expect(missing?.status()).toBe(404);

  const draft = await page.goto("/guias/borrador-interno");
  expect(draft?.status()).toBe(404);
});

test("cliente sin codigo vuelve a la entrada principal", async ({ page }) => {
  await page.goto("/cliente");

  await expect(page).toHaveURL("/consulta");
  await expect(page.getByRole("heading", { name: "Consulta el estado de tu proceso" })).toBeVisible();
});

test("cliente entra con correo y cambia entre sus casos activos", async ({ page }) => {
  await page.goto("/consulta");

  await page.getByTestId("public-tracking-code").fill("laura@constructoranorte.co");
  await page.getByTestId("captcha-answer").fill("10");
  await page.getByTestId("public-search").click();

  await expect(page).toHaveURL(/\/cliente\?consulta=laura%40constructoranorte.co/);
  await expect(page.getByTestId("client-case-switcher")).toContainText("2 asuntos");
  await expect(page.getByTestId("client-case-option-case-1")).toContainText(
    "Licitacion municipal 2026",
  );
  await expect(page.getByTestId("client-case-option-case-2")).toContainText(
    "Contrato de obra con proveedor",
  );
  await expect(page.getByRole("heading", { name: "Licitacion municipal 2026" })).toBeVisible();

  await page.getByTestId("client-case-option-case-2").click();

  await expect(page.getByRole("heading", { name: "Contrato de obra con proveedor" })).toBeVisible();
  await expect(page.getByTestId("client-next-step")).toContainText(
    "Enviar version marcada al cliente.",
  );
});

test("firma redirige a login cuando no hay sesion interna", async ({ page }) => {
  await page.goto("/firma");

  await expect(page).toHaveURL("/firma/login");
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  await expect(page.getByTestId("firm-demo-users")).toContainText("socia@asuntia.local");
});

test("firma usa la bandeja de trabajo para abrir asuntos pendientes", async ({ page }) => {
  await loginFirm(page);

  await expect(page.getByTestId("firm-work-queue")).toContainText("Bandeja de trabajo");
  await expect(page.getByTestId("work-queue-item-milestone-milestone-9")).toContainText(
    "Solicitud de informacion laboral",
  );

  await page.getByTestId("work-queue-item-milestone-milestone-9").click();

  await expect(page.getByRole("heading", { name: "Andes Foods" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Concepto laboral sobre turnos" })).toBeVisible();
  await expect(page.getByText("Reporte de turnos")).toBeVisible();
});

test("asistente entra al workspace en modo lectura", async ({ page }) => {
  await loginFirm(page, "asistente@asuntia.local");

  await expect(page.getByTestId("open-case-drawer")).toHaveCount(0);
  await expect(page.getByTestId("save-case")).toBeDisabled();
  await expect(page.getByTestId("create-milestone")).toHaveCount(0);
  await expect(page.getByTestId("publish-update")).toHaveCount(0);
});

test("firma publica avance, solicitud y documento visibles para el cliente", async ({ page }) => {
  await loginFirm(page);
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

  await page.goto("/consulta");
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
  await loginFirm(page);
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

  await page.goto("/consulta");
  await page.getByTestId("public-tracking-code").fill("AS-2026-001");
  await page.getByTestId("captcha-answer").fill("10");
  await page.getByTestId("public-search").click();

  await expect(page.locator(".tracking-main").getByText("En espera")).toBeVisible();
  await expect(page.getByTestId("client-next-step")).toContainText(
    "Esperar respuesta de la entidad antes de radicar observaciones.",
  );
});

test("firma gestiona hitos y el cliente ve el nuevo punto actual del proceso", async ({ page }) => {
  await loginFirm(page);
  await page.getByTestId("case-card-case-1").click();

  await page.getByTestId("milestone-title").fill("Radicacion confirmada");
  await page.getByTestId("milestone-date").fill("2026-07-12");
  await page.getByTestId("milestone-status").selectOption("current");
  await page.getByTestId("milestone-evidence").check();
  await page
    .getByTestId("milestone-description")
    .fill("La firma radico observaciones y espera soporte final del cliente.");
  await page
    .getByTestId("milestone-detail")
    .fill("El soporte final debe quedar visible al cliente antes del cierre.");
  const milestoneSaved = waitForWorkspaceSave(page);
  await page.getByTestId("create-milestone").click();
  await milestoneSaved;

  await expect(page.getByText("Radicacion confirmada")).toBeVisible();
  await expect(page.getByTestId("milestone-status-milestone-3")).toHaveValue("completed");

  await page.goto("/consulta");
  await page.getByTestId("public-tracking-code").fill("AS-2026-001");
  await page.getByTestId("captcha-answer").fill("10");
  await page.getByTestId("public-search").click();

  await expect(page.locator(".milestone-current").filter({ hasText: "Radicacion confirmada" })).toBeVisible();
  await expect(page.getByTestId("milestone-milestone-3")).toHaveClass(/milestone-completed/);
  await expect(
    page.getByText("El soporte final debe quedar visible al cliente antes del cierre."),
  ).toBeVisible();
});
