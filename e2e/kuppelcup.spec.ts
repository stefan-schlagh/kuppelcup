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

test("Urkunden preview stays light-mode even when the app is in dark mode", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("button", { name: "Beispiel-Teams laden" }).click();

  // Dark is the default theme (useStorage("kuppelcup:theme", "dark")) --
  // no toggle needed on a fresh session.
  const appTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  expect(appTheme).toBe("dark");

  await page.getByRole("button", { name: "Urkunden", exact: true }).click();
  const preview = page.locator(".urkunde").first();
  await expect(preview).toBeVisible();
  const bg = await preview.evaluate((el) => getComputedStyle(el).backgroundColor);
  // The generated PDF (jsPDF) is always white -- the preview must match
  // regardless of the app's current theme, not follow it into dark mode.
  expect(bg).toBe("rgb(255, 255, 255)");
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

test("login persists across a reload", async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page.getByText("Meine Events")).toBeVisible();

  await page.reload();
  // Tab selection itself isn't persisted -- back on "Bestenliste" -- but the
  // signed-in session should be, so Admin goes straight to the panel again
  // instead of the login form.
  await page.getByRole("button", { name: /^Admin$/ }).click();

  await expect(page.getByRole("button", { name: /Abmelden \(admin\)/ })).toBeVisible();
  await expect(page.getByText("Meine Events")).toBeVisible();
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

test("an admin can create, rename, switch between, and delete events", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("button", { name: "Event & Teams" }).click();

  await page.getByPlaceholder("Neuer Event-Name, z.B. 2. Geissberg KUPPELCUP").fill("Zweites Event");
  await page.getByRole("button", { name: "Event anlegen +" }).click();
  const rows = page.locator(".data-table").first().locator("tbody tr");
  await expect(rows).toHaveCount(2);

  // A freshly created event becomes current immediately -- no "Öffnen"
  // button on its own row (that's only for switching away from it).
  const newRow = page.locator("tr", { hasText: "Zweites Event" });
  await expect(newRow.getByRole("button", { name: "Öffnen" })).toHaveCount(0);
  await expect(newRow).toHaveClass(/row-qualified/);

  page.once("dialog", (d) => d.accept("Zweites Event (umbenannt)"));
  await newRow.getByRole("button", { name: "Umbenennen" }).click();
  const renamedRow = page.locator("tr", { hasText: "Zweites Event (umbenannt)" });
  await expect(renamedRow).toBeVisible();

  // Switch back to the starter event.
  const starterRow = page.locator("tr", { hasText: "1. Geissberg KUPPELCUP" });
  await starterRow.getByRole("button", { name: "Öffnen" }).click();
  await expect(starterRow).toHaveClass(/row-qualified/);
  await expect(renamedRow.getByRole("button", { name: "Öffnen" })).toBeVisible();

  page.once("dialog", (d) => d.accept());
  await renamedRow.getByRole("button", { name: "✕" }).click();
  await expect(rows).toHaveCount(1);
});

test("visiting an event's own URL (?event=<id>) loads that specific event", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("button", { name: "Event & Teams" }).click();
  await page.getByPlaceholder("Neuer Event-Name, z.B. 2. Geissberg KUPPELCUP").fill("Geteiltes Event");
  await page.getByRole("button", { name: "Event anlegen +" }).click();
  const eventUrl = page.url();

  await page.locator("tr", { hasText: "1. Geissberg KUPPELCUP" }).getByRole("button", { name: "Öffnen" }).click();
  await page.goto(eventUrl);
  await page.getByRole("button", { name: "Admin" }).click();
  await page.getByRole("button", { name: "Event & Teams" }).click();
  await expect(page.locator("tr.row-qualified")).toContainText("Geteiltes Event");
});

test("the QR panel shows the shareable link for an event", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("button", { name: "Event & Teams" }).click();
  await page.locator("tr", { hasText: "1. Geissberg KUPPELCUP" }).getByRole("button", { name: "QR" }).click();
  await expect(page.locator(".qr-panel")).toBeVisible();
  await expect(page.locator(".qr-img")).toBeVisible();
  await expect(page.locator(".qr-url code")).toContainText("?event=");
});

test("Gastgeber and Gemeindewertung checkboxes toggle a team's flags and persist", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("button", { name: "Beispiel-Teams laden" }).click();
  await page.getByRole("button", { name: "Event & Teams" }).click();

  const teamsTable = page.locator(".data-table").nth(1);
  const firstRow = teamsTable.locator("tbody tr").first();
  const gastgeberCheckbox = firstRow.locator('input[type="checkbox"]').nth(0);
  const gemeindeCheckbox = firstRow.locator('input[type="checkbox"]').nth(1);

  // seedTeams() marks only the first team as Gastgeber.
  await expect(gastgeberCheckbox).toBeChecked();
  await gastgeberCheckbox.uncheck();
  await expect(gemeindeCheckbox).not.toBeChecked();
  await gemeindeCheckbox.check();

  // Persisted across a tab switch (not just local component state).
  await page.getByRole("button", { name: "Grunddurchgang erfassen" }).click();
  await page.getByRole("button", { name: "Event & Teams" }).click();
  await expect(teamsTable.locator("tbody tr").first().locator('input[type="checkbox"]').nth(0)).not.toBeChecked();
  await expect(teamsTable.locator("tbody tr").first().locator('input[type="checkbox"]').nth(1)).toBeChecked();
});

test("removing a team asks for confirmation and only removes it once accepted", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("button", { name: "Beispiel-Teams laden" }).click();
  await page.getByRole("button", { name: "Event & Teams" }).click();

  const teamsTable = page.locator(".data-table").nth(1);
  const firstRowName = () => teamsTable.locator("tbody tr").first().locator(".input-field-name").inputValue();
  const nameBefore = await firstRowName();

  page.once("dialog", (d) => {
    expect(d.message()).toContain(nameBefore);
    d.dismiss();
  });
  await teamsTable.getByTitle("Team entfernen").first().click();
  await expect.poll(firstRowName).toBe(nameBefore); // cancelled -- nothing removed

  page.once("dialog", (d) => d.accept());
  await teamsTable.getByTitle("Team entfernen").first().click();
  await expect.poll(firstRowName).not.toBe(nameBefore); // confirmed -- team removed
});

test("teams can only be added/removed during Anmeldung, and everything locks once abgeschlossen", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("button", { name: "Beispiel-Teams laden" }).click();
  await page.getByRole("button", { name: "Event & Teams" }).click();

  await page.getByRole("button", { name: "Durchführung" }).click();
  await expect(page.getByText("Teams können nur in der Anmeldungs-Phase hinzugefügt oder entfernt werden.")).toBeVisible();
  const teamsTable = page.locator(".data-table").nth(1);
  await expect(teamsTable.getByTitle("Team entfernen")).toHaveCount(0);
  // Not locked yet -- checkboxes still editable in Durchführung.
  await expect(teamsTable.locator('input[type="checkbox"]').first()).toBeEnabled();

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Abgeschlossen" }).click();

  await expect(teamsTable.locator('input[type="checkbox"]').first()).toBeDisabled();
  await page.getByRole("button", { name: "Grunddurchgang erfassen" }).click();
  await expect(page.getByText("Event abgeschlossen — Eingaben gesperrt.")).toBeVisible();
  await expect(page.locator(".input-field").first()).toBeDisabled();
});

test("start number: up/down arrows move a team by one position, jump input moves it to an exact position", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("button", { name: "Beispiel-Teams laden" }).click();

  const rows = page.locator(".data-table tbody tr:has(.start-nr-value)");
  const nameAt = (i: number) => rows.nth(i).locator(".input-field-name").inputValue();
  const firstName = await nameAt(0);
  const secondName = await nameAt(1);
  const thirdName = await nameAt(2);
  const fourthName = await nameAt(3);

  // Up arrow on the 2nd row swaps it with the 1st -- moves it up the list.
  await rows.nth(1).locator(".start-nr-btn").first().click();
  await expect.poll(() => nameAt(0)).toBe(secondName);
  await expect.poll(() => nameAt(1)).toBe(firstName);

  // Down arrow on the (now first) row swaps it back.
  await rows.nth(0).locator(".start-nr-btn").nth(1).click();
  await expect.poll(() => nameAt(0)).toBe(firstName);
  await expect.poll(() => nameAt(1)).toBe(secondName);

  // Typing a target position only applies once "OK" is pressed -- moves the
  // team there while keeping every other team's relative order.
  await rows.nth(0).locator(".start-nr-jump input").fill("4");
  await expect(nameAt(0)).resolves.toBe(firstName); // not applied yet
  await rows.nth(0).locator(".start-nr-jump button").click();

  await expect.poll(() => nameAt(0)).toBe(secondName);
  await expect.poll(() => nameAt(1)).toBe(thirdName);
  await expect.poll(() => nameAt(2)).toBe(fourthName);
  await expect.poll(() => nameAt(3)).toBe(firstName);

  const starts = await page.locator(".data-table tbody .start-nr-value").allInnerTexts();
  expect(new Set(starts).size).toBe(starts.length); // still unique, no gaps/duplicates
});

test("the theme toggle switches between dark and light and persists across a reload", async ({ page }) => {
  await page.goto("/");
  const theme = () => page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  await expect.poll(theme).toBe("dark");
  await page.getByRole("button", { name: "Hell/Dunkel wechseln" }).click();
  await expect.poll(theme).toBe("light");
  await page.reload();
  await expect.poll(theme).toBe("light");
});
