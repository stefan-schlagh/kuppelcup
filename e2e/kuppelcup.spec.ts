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

test("a tied K.O. heat shows a Stechlauf notice on the Live-Monitor", async ({ page }) => {
  await loginAsAdmin(page);
  await loadSampleTeamsWithResults(page); // fills base round + all K.O. matches

  // Tie the Final specifically: with every match already decided, the
  // bracket stays fully complete either way, so Live-Monitor's "former"
  // heat (the most recently finished one) is still the Final -- just now
  // a tied one, rather than needing to re-engineer which heat is "current".
  await page.getByRole("button", { name: "K.O.-Ergebnisse" }).click();
  const final = page.locator(".bracket-col-final");
  const timeInputs = final.locator(".bracket-input-time");
  const penaltyInputs = final.locator(".bracket-input-penalty");
  await timeInputs.nth(0).fill("21.00");
  await timeInputs.nth(1).fill("21.00");
  await penaltyInputs.nth(0).fill("0");
  await penaltyInputs.nth(1).fill("0");

  await page.getByRole("button", { name: "Live-Monitor" }).click();
  await expect(page.getByText("Unentschieden — Stechlauf nötig")).toHaveCount(2);
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

test("CSV backup includes K.O. results and restores them on import", async ({ page }) => {
  await loginAsAdmin(page);
  await loadSampleTeamsWithResults(page);

  await page.getByRole("button", { name: "K.O.-Ergebnisse" }).click();
  const timeInputs = page.locator(".bracket-input-time");
  const originalQf1RunA = await timeInputs.first().inputValue();
  expect(originalQf1RunA).not.toBe("");

  await page.getByRole("button", { name: "Backup" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export als CSV" }).click();
  const download = await downloadPromise;
  const csv = await readFile((await download.path())!, "utf8");
  expect(csv).toContain("match,side,zeit,strafe");

  // Clear the recorded time to prove the import actually restores it below,
  // not just that it was never gone.
  await page.getByRole("button", { name: "K.O.-Ergebnisse" }).click();
  await timeInputs.first().fill("");
  await expect(timeInputs.first()).toHaveValue("");

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Backup" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "backup.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });

  await page.getByRole("button", { name: "K.O.-Ergebnisse" }).click();
  await expect(timeInputs.first()).toHaveValue(originalQf1RunA);
});

test("admin can export Urkunden as a PDF, one certificate per participant", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("button", { name: "Beispiel-Teams laden" }).click();
  await page.getByRole("button", { name: "Urkunden", exact: true }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Als PDF exportieren/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^urkunden-.*\.pdf$/);

  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
  // 20 sample teams -> 20 certificate pages.
  expect(bytes.toString("latin1")).toMatch(/\/Count\s+20\b/);
});

test("Urkunden preview renders the actual generated PDF, in a dark-themed app", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("button", { name: "Beispiel-Teams laden" }).click();

  // Dark is the default theme (useStorage("kuppelcup:theme", "dark")) --
  // no toggle needed on a fresh session. The preview is a react-pdf
  // <PDFViewer> (an iframe showing the real, generated PDF via a blob:
  // URL), not themed HTML -- it can't inherit the app's dark mode by
  // construction, unlike the old hand-rolled HTML/CSS preview this
  // replaced, so there's nothing theme-related left to assert here beyond
  // "it still works while the app is dark."
  const appTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  expect(appTheme).toBe("dark");

  await page.getByRole("button", { name: "Urkunden", exact: true }).click();
  // Generous timeout: this is the one spot that lazy-loads
  // @react-pdf/renderer's full browser bundle (~480kB) *and* renders a
  // real PDF before the iframe even appears, unlike the other lazy-PDF
  // paths (which only fetch on a button click, not on tab open).
  const iframe = page.locator("iframe");
  await expect(iframe).toBeVisible({ timeout: 15000 });
  await expect.poll(() => iframe.evaluate((el) => (el as HTMLIFrameElement).src), { timeout: 15000 }).toMatch(/^blob:/);
});

test("entering a result flashes a brief 'Gespeichert' confirmation", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("button", { name: "Beispiel-Teams laden" }).click();

  const savedFlash = page.locator(".saved-flash");
  await expect(savedFlash).not.toHaveClass(/is-visible/);

  await page.getByRole("button", { name: "Grunddurchgang erfassen" }).click();
  await page.locator(".input-field").first().fill("20.00");

  // The save is debounced (400ms) then persisted -- the flash should show
  // up once that's done, then fade back out on its own a bit later.
  await expect(savedFlash).toHaveClass(/is-visible/, { timeout: 3000 });
  await expect(savedFlash).not.toHaveClass(/is-visible/, { timeout: 3000 });
});

test("clearing an entered Grunddurchgang time doesn't leave a stale NaN score (regression)", async ({ page }) => {
  // Regression test: the DG1/DG2 zeit inputs used a bare parseFloat(), so
  // clearing a filled-in field produced NaN instead of null (parseFloat("")
  // is NaN) -- unlike the equivalent K.O. input, which already null-guarded
  // this. NaN then poisoned punkte()/byPunkte() ranking silently.
  await loginAsAdmin(page);
  await page.getByRole("button", { name: "Beispiel-Teams laden" }).click();
  await page.getByRole("button", { name: "Grunddurchgang erfassen" }).click();

  const zeitInputs = page.locator(".input-field");
  await zeitInputs.nth(0).fill("20.00");
  await zeitInputs.nth(1).fill("21.00");
  await zeitInputs.nth(0).fill(""); // clear DG1 zeit for the first team again

  await page.getByRole("button", { name: "Bestenliste", exact: true }).click();
  await expect(page.getByText("NaN")).toHaveCount(0);
  // The first team's Punkte must still be a real number (from its DG2 run,
  // 21), not NaN swallowing the whole ranking calculation.
  await expect(page.locator(".data-table").first().locator("tbody tr").first().locator(".td-best")).toHaveText("21");
});

test("a wrong password shows an inline error and does not sign in", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Admin" }).click();
  await page.getByPlaceholder("E-Mail-Adresse").first().fill("admin");
  await page.getByPlaceholder("Passwort").fill("definitely-wrong");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.locator(".pin-error")).toBeVisible();
  await expect(page.getByText("Meine Events")).toHaveCount(0);
});

test("passwordless e-mail sign-in logs in immediately against the local backend", async ({ page }) => {
  // FirebaseBackend can't sign in synchronously (real email-link flow), but
  // LocalBackend's stub does -- e2e always runs on LocalBackend, so this is
  // reachable end-to-end unlike the "check your email" notice path.
  await page.goto("/");
  await page.getByRole("button", { name: "Admin" }).click();
  await page.getByPlaceholder("E-Mail-Adresse").nth(1).fill("chef@ff-example.at");
  await page.getByRole("button", { name: "Link per E-Mail (passwortlos)" }).click();
  await expect(page.getByText("Meine Events")).toBeVisible();
  await expect(page.getByRole("button", { name: /chef@ff-example\.at/ })).toBeVisible();
  // Brand-new admin -- no events yet.
  await expect(page.getByText("Teams (0)")).toBeVisible();
});

test("a newly created admin account starts with no events, and the team form only appears once one exists", async ({ page }) => {
  // Regression test: AdminPanel's add-team input used to render whenever
  // phase === "anmeldung" (the default with no current event at all), so a
  // brand-new admin could type a team name and click "Hinzufügen +" and have
  // it silently discarded -- addTeam/setTeams both no-op without a current
  // event, with zero feedback.
  await page.goto("/");
  await page.getByRole("button", { name: "Admin" }).click();
  await page.getByPlaceholder("E-Mail-Adresse").first().fill("ff-neu-admin@example.at");
  await page.getByPlaceholder("Passwort").fill("secret123");
  await page.getByRole("button", { name: "Neues Konto erstellen" }).click();
  await expect(page.getByText("Meine Events")).toBeVisible();
  await expect(page.locator(".data-table").first().locator("tbody tr")).toHaveCount(0);

  await expect(page.getByText("Bitte zuerst oben ein Event anlegen oder auswählen.")).toBeVisible();
  await expect(page.getByPlaceholder("Teamname, z.B. FF Buchberg")).toHaveCount(0);

  await page.getByPlaceholder("Neuer Event-Name, z.B. 2. Geissberg KUPPELCUP").fill("Mein Event");
  await page.getByRole("button", { name: "Event anlegen +" }).click();

  await expect(page.getByPlaceholder("Teamname, z.B. FF Buchberg")).toBeVisible();
  await page.getByPlaceholder("Teamname, z.B. FF Buchberg").fill("FF Testteam");
  await page.getByRole("button", { name: "Hinzufügen +" }).click();
  await expect(page.getByText("Teams (1)")).toBeVisible();
});

