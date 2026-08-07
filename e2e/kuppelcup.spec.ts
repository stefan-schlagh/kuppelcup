import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

// Runs against LocalBackend only (see playwright.config.ts) — the seeded
// local admin (admin/admin) always starts with one starter event and no
// teams, so every test loads its own sample data.
async function loginAsAdmin(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Admin" }).click();
  // Two "E-Mail-Adresse" fields exist (password login + passwordless email
  // link); the password one is first in the DOM.
  await page.getByPlaceholder("E-Mail-Adresse").first().fill("admin");
  await page.getByPlaceholder("Passwort").fill("admin");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByText("Meine Events")).toBeVisible();
}

async function loadSampleTeamsWithResults(page: Page) {
  await page.getByRole("button", { name: "Beispiel-Teams laden" }).click();
  await page.getByRole("button", { name: "Zufallsergebnisse erzeugen (inkl. K.O.)" }).click();
  await page.getByRole("button", { name: "Durchführung" }).click();
}

test("loads the public Bestenliste without signing in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Bestenliste — Grunddurchgang")).toBeVisible();
});

test("admin can log in, load sample data, and see a full K.O. bracket", async ({ page }) => {
  await loginAsAdmin(page);
  await loadSampleTeamsWithResults(page);

  await page.getByRole("button", { name: "Turnierbaum", exact: true }).click();
  await expect(page.getByText("Turnierbaum — Top 8")).toBeVisible();
  // Every QF/SF/Final match box is populated (no lone "—" with 8 real teams).
  await expect(page.locator(".match-box")).toHaveCount(7);
  await expect(page.locator(".match-tied-badge")).toHaveCount(0);
});

test("an exact K.O. tie is flagged and does not advance to the semi-final", async ({ page }) => {
  await loginAsAdmin(page);
  await loadSampleTeamsWithResults(page);

  await page.getByRole("button", { name: "K.O.-Ergebnisse" }).click();
  const timeInputs = page.locator(".bracket-input-time");
  const penaltyInputs = page.locator(".bracket-input-penalty");
  // Force the first QF match (indices 0 and 1) to an exact tie.
  await timeInputs.nth(0).fill("21.00");
  await timeInputs.nth(1).fill("21.00");
  await penaltyInputs.nth(0).fill("0");
  await penaltyInputs.nth(1).fill("0");

  await page.getByRole("button", { name: "Turnierbaum", exact: true }).click();
  const tiedMatch = page.locator(".match-box", { has: page.locator(".match-tied-badge") });
  await expect(tiedMatch).toHaveCount(1);
  await expect(tiedMatch.locator(".match-winner")).toHaveCount(0);
  // The semi-final slot fed by the tied match has no team yet ("—").
  const semiFinal = page.locator(".bracket-col", { hasText: "Halbfinale" }).first();
  await expect(semiFinal.getByText("—")).toBeVisible();
});

test("a base-round tie within places 1-7 is flagged as Gleichstand", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("button", { name: "Beispiel-Teams laden" }).click();

  await page.getByRole("button", { name: "Grunddurchgang erfassen" }).click();
  const zeitInputs = page.locator(".input-field");
  // First two teams' DG1 tie at 20.00; DG2 kept clearly different so punkte
  // (min of the two) ties unambiguously at 20.
  await zeitInputs.nth(0).fill("20.00"); // team 1 dg1
  await zeitInputs.nth(1).fill("30.00"); // team 1 dg2
  await zeitInputs.nth(2).fill("20.00"); // team 2 dg1
  await zeitInputs.nth(3).fill("31.00"); // team 2 dg2

  await page.getByRole("button", { name: "Bestenliste", exact: true }).click();
  await expect(page.getByText("Gleichstand")).toHaveCount(2);
  await expect(page.getByText("Stechlauf", { exact: true })).toHaveCount(0);
});

test("Gemeindewertung follows the overall (K.O.-aware) standings, not raw base rank", async ({ page }) => {
  await loginAsAdmin(page);
  await loadSampleTeamsWithResults(page);

  // Read the actual K.O. champion (random data, so read it back rather than
  // assuming a name) and the worst base-round team.
  await page.getByRole("button", { name: "Turnierbaum", exact: true }).click();
  const championName = await page.locator(".bracket-col-final .match-winner .team-name-span").innerText();

  await page.getByRole("button", { name: "Bestenliste", exact: true }).click();
  const lastRowName = await page.locator(".data-table").first().locator("tbody tr").last().locator(".td-name").innerText();

  // Mark both as Gemeinde teams.
  await page.getByRole("button", { name: "Admin" }).click();
  await page.getByRole("button", { name: "Event & Teams" }).click();
  for (const name of [championName, lastRowName]) {
    await page.locator("tr", { hasText: name }).locator('input[type="checkbox"]').nth(1).check();
  }

  await page.getByRole("button", { name: "Bestenliste", exact: true }).click();
  const gemeindeSection = page.locator("h2", { hasText: "Bestenliste — Gemeindewertung" }).locator("xpath=..");
  const rows = gemeindeSection.locator(".data-table tbody tr");
  await expect(rows).toHaveCount(2);
  // The K.O. champion outranks the worst base-round team in Gemeindewertung
  // even though base rank alone would put it last — proof this reflects
  // gesamtwertung, not ranked.filter(gemeinde).
  await expect(rows.first().locator(".td-name")).toHaveText(championName);
  await expect(rows.last().locator(".td-name")).toHaveText(lastRowName);
});

test("admin can export the combined Gesamtbericht PDF; the button is admin-only", async ({ page }) => {
  // Public view: no Admin panel, so no export button exists anywhere.
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Gesamtbericht als PDF/ })).toHaveCount(0);

  await loginAsAdmin(page);
  await loadSampleTeamsWithResults(page);
  await page.getByRole("button", { name: "Backup" }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Gesamtbericht als PDF/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^gesamtbericht-.*\.pdf$/);

  const path = await download.path();
  const bytes = await readFile(path!);
  expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
  expect(bytes.length).toBeGreaterThan(500);
});
