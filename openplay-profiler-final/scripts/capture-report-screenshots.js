const path = require("path");
const { chromium } = require("playwright-core");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "informe", "figures");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function clickByText(page, text, options = {}) {
  const locator = page.getByText(text, { exact: options.exact ?? false }).first();
  await locator.waitFor({ state: "visible", timeout: options.timeout ?? 30000 });
  await locator.click();
}

async function shot(page, name) {
  await page.screenshot({
    path: path.join(outDir, name),
    fullPage: false,
  });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });

  page.setDefaultTimeout(45000);
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

  await clickByText(page, "Cargar openplay_consolidated.csv", { timeout: 60000 });
  await page.getByText("participantes", { exact: false }).first().waitFor({ state: "visible", timeout: 60000 });
  await page.waitForTimeout(1200);
  await shot(page, "fig00_app_overview.png");
  await shot(page, "fig00_data_view.png");

  await clickByText(page, "Profiling", { exact: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: /^age\b/i }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  await shot(page, "fig00_profiling_view.png");

  await clickByText(page, "Bivariado", { exact: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator("select").nth(0).selectOption("telem_total_sessions").catch(() => {});
  await page.locator("select").nth(1).selectOption("telem_nocturnal_sessions").catch(() => {});
  await page.locator("select").nth(2).selectOption("gdt_total").catch(() => {});
  await page.getByRole("button", { name: /Desactivada/i }).click().catch(() => {});
  await page.waitForTimeout(1800);
  await shot(page, "fig00_bivariate_view.png");

  await clickByText(page, "Vector", { exact: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  await clickByText(page, "Seleccionar vector integral recomendado", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(900);
  await shot(page, "fig00_vector_view.png");

  await clickByText(page, "Encuestas", { exact: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1400);
  await shot(page, "fig00_surveys_view.png");

  await clickByText(page, "Filtros", { exact: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByPlaceholder(/Buscar variable para filtrar/i).fill("num_platforms").catch(() => {});
  await page.waitForTimeout(300);
  await page.locator('input[type="number"]').first().fill("3").catch(() => {});
  await page.getByRole("button", { name: /^Aplicar$/i }).click().catch(() => {});
  await page.waitForTimeout(1200);
  await shot(page, "fig00_filters_view.png");

  await clickByText(page, "PCA / t-SNE / UMAP", { exact: true });
  await page.waitForTimeout(800);
  await clickByText(page, "Ejecutar PCA", { timeout: 20000 });
  await page.waitForTimeout(2500);
  await page.getByText("Clustering sobre el espacio 2D", { exact: false }).first().waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
  await page.locator("button").filter({ hasText: /Ejecutar K-means/i }).first().click().catch(() => {});
  await page.waitForTimeout(1800);
  await page.evaluate(() => window.scrollTo(0, 650));
  await page.waitForTimeout(500);
  await shot(page, "fig00_reduction_view.png");

  await clickByText(page, "Validacion", { exact: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(2200);
  await shot(page, "fig00_validation_view.png");

  await browser.close();
})();
