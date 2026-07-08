import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

async function resetWorkspace(request: APIRequestContext) {
  const reset = await request.delete("/api/workspace");
  expect(reset.ok()).toBeTruthy();
}

async function loginFirm(page: Page) {
  await page.goto("/firma/login");
  await page.getByTestId("firm-email").fill("socia@asuntia.local");
  await page.getByTestId("firm-password").fill("AsuntiaDemo2026!");
  await page.getByTestId("firm-login").click();
  await expect(page).toHaveURL("/firma");
}

test.beforeEach(async ({ request }) => {
  await resetWorkspace(request);
});

test.describe("visual regression", () => {
  test("firm landing stays visually stable on desktop and mobile", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: "Insolvencia con estrategia, orden y seguimiento claro",
      }),
    ).toBeVisible();
    await expect(page).toHaveScreenshot("home-desktop.png", {
      animations: "disabled",
      caret: "initial",
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: "Insolvencia con estrategia, orden y seguimiento claro",
      }),
    ).toBeVisible();
    await expect(page).toHaveScreenshot("home-mobile.png", {
      animations: "disabled",
      caret: "initial",
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });

  test("public consultation stays visually stable", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/consulta");
    await expect(page.getByRole("heading", { name: "Consulta el estado de tu proceso" })).toBeVisible();
    await expect(page).toHaveScreenshot("consultation-desktop.png", {
      animations: "disabled",
      caret: "initial",
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });

  test("client tracking surface stays visually stable", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/cliente?codigo=AS-2026-001");
    await expect(page.getByRole("heading", { name: "Licitacion municipal 2026" })).toBeVisible();
    await expect(page.getByTestId("client-action-card")).toBeVisible();
    await expect(page).toHaveScreenshot("client-tracking-desktop.png", {
      animations: "disabled",
      caret: "initial",
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });

  test("firm login and workspace stay visually stable", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });

    await page.goto("/firma/login");
    await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
    await expect(page).toHaveScreenshot("firm-login-desktop.png", {
      animations: "disabled",
      caret: "initial",
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });

    await loginFirm(page);
    await expect(page.getByRole("heading", { name: "Constructora Norte S.A.S." })).toBeVisible();
    await expect(page).toHaveScreenshot("firm-workspace-desktop.png", {
      animations: "disabled",
      caret: "initial",
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });
});

test.describe("local performance budgets", () => {
  test("firm landing route loads within a local interaction budget after warmup", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: "Insolvencia con estrategia, orden y seguimiento claro",
      }),
    ).toBeVisible();

    await page.goto("about:blank");
    const startedAt = Date.now();
    await page.goto("/", { waitUntil: "load" });
    await expect(
      page.getByRole("heading", {
        name: "Insolvencia con estrategia, orden y seguimiento claro",
      }),
    ).toBeVisible();
    const wallTimeMs = Date.now() - startedAt;

    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;

      return {
        domContentLoadedMs: navigation
          ? navigation.domContentLoadedEventEnd - navigation.startTime
          : 0,
        loadMs: navigation ? navigation.loadEventEnd - navigation.startTime : 0,
      };
    });

    expect(wallTimeMs).toBeLessThan(2500);
    expect(metrics.domContentLoadedMs).toBeLessThan(1800);
    expect(metrics.loadMs).toBeLessThan(2200);
  });

  test("workspace API returns demo data within a local processing budget after warmup", async ({
    request,
  }) => {
    const warmup = await request.get("/api/workspace");
    expect(warmup.ok()).toBeTruthy();

    const startedAt = Date.now();
    const response = await request.get("/api/workspace");
    const durationMs = Date.now() - startedAt;
    const data = await response.json();

    expect(response.ok()).toBeTruthy();
    expect(durationMs).toBeLessThan(1500);
    expect(data.cases).toHaveLength(3);
    expect(data.guides.filter((guide: { status: string }) => guide.status === "published")).toHaveLength(4);
    expect(data.practiceAreas).toHaveLength(4);
    expect(data.caseStudies).toHaveLength(3);
    expect(data.documents.every((document: { visibility: string }) => document.visibility)).toBe(
      true,
    );
  });
});
