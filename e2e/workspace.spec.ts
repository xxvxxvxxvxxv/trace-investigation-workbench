import { expect, test } from "@playwright/test";
test("fictional case capture, inspector, persistence, analysis and backup", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Cases", exact: true }).click();
  await page.getByRole("button", { name: "Add case", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Title", { exact: false })
    .fill("Fictional beta smoke case");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await page.getByRole("link", { name: "Evidence", exact: true }).click();
  await page.getByRole("button", { name: "Add evidence", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Title", { exact: false })
    .fill("Fictional smoke observation");
  await page.getByRole("button", { name: "Save record", exact: true }).click();
  await page
    .getByRole("button", { name: "Fictional smoke observation", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Record inspector" }),
  ).toContainText("Fictional smoke observation");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Fictional smoke observation", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Graph", exact: true }).click();
  await expect(page.getByLabel("Graph layout")).toBeVisible();
  await page
    .getByLabel("Inspect a graph node")
    .selectOption({ label: "E001 · Fictional smoke observation" });
  await expect(
    page.getByRole("complementary", { name: "Record inspector" }),
  ).toContainText("Fictional smoke observation");
  await page.getByRole("button", { name: "Close details" }).click();
  await page.getByRole("link", { name: "Map", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Online basemap" })).not.toBeChecked();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.getByText("FICTIONAL CASE", { exact: true })).toHaveCount(0);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export entire database", exact: true }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/^TRACE-backup-.*\.json$/);
});
