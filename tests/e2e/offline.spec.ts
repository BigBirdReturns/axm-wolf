import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// End-to-end offline/round-trip flow (DESIGN.md 14.6). Runs against a real
// Chromium build via `npm run test:e2e:real` (requires
// `npx playwright install chromium`, which downloads a browser binary --
// not possible in some sandboxes; see tests/e2e/README.md).
//
// Selectors below are taken verbatim from the rendered components; each
// step's comment cites the source line it was derived from.

const DRAFT_TEXT = 'Draft note: thinking about the jump from fast food to IT at SMU.';
const FIRST_RESPONSE = 'I took night classes while managing the restaurant, and a regular customer who worked at SMU offered me a part-time data-entry job.';
const SECOND_RESPONSE = 'Revised: I took night classes while managing the restaurant, and a regular customer who worked in SMU\'s computing center offered me a part-time data-entry job that turned into systems work.';

test.describe('AXM Wolf offline capture + export/import round trip', () => {
  test('create record, draft survives reload, commit revisions, export/import, go offline', async ({
    page,
    context,
  }, testInfo) => {
    // --- Step 1: launch the app (single-pack framing OK; bundled pack
    // auto-installs regardless of deploy mode -- see
    // src/app/hooks/useWolfApp.ts BUNDLED_PACK / wolfs-deposition pack). ---
    await test.step('launch app', async () => {
      await page.goto('/');
      // LaunchScreen.tsx:78 -- "Create a record" section heading is always
      // present once packs have loaded.
      await expect(page.getByRole('heading', { name: 'Create a record' })).toBeVisible();
    });

    // --- Step 2: create the William Sandhu record. ---
    // LaunchScreen.tsx:88 -- button text is
    // `New record from ${storedPack.pack.title}`, and the bundled pack's
    // title is "The Wolf's Deposition" (src/packs/wolfs-deposition/...json).
    await test.step('create the William Sandhu record', async () => {
      await page.getByRole('button', { name: "New record from The Wolf's Deposition" }).click();
      // RecordHomeScreen.tsx:94 -- <h1>{record.title}</h1>, title defaults to
      // the pack title; subject display name is "William Sandhu"
      // (subjectDefaults in wolfs-deposition.wolfpack.json).
      await expect(page.getByRole('heading', { level: 1, name: "The Wolf's Deposition" })).toBeVisible();
      await expect(page.getByText('William Sandhu')).toBeVisible();
    });

    // --- Step 3: navigate into a section and open a prompt OUT OF ORDER. ---
    await test.step('open a section and an out-of-order prompt', async () => {
      // RecordHomeScreen.tsx:146-156 -- SectionCard renders section.label as
      // its link text; "The Early Years" is the first section's label
      // (wolfs-deposition.wolfpack.json sections[0].label).
      await page.getByRole('link', { name: /The Early Years/ }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'The Early Years' })).toBeVisible();

      // SectionScreen.tsx:157 -- each prompt card shows prompt.text. Pick the
      // SECOND prompt in the section (out of order, not the first) --
      // prompts[1] for section 'early' is
      // "early.you-went-from-managing-fast-food-in-new":
      // "You went from managing fast food in New York to IT systems
      // analysis at SMU in Dallas. What happened in between that made that
      // jump feel logical?"
      await page
        .getByText('You went from managing fast food in New York to IT systems analysis')
        .click();

      // PromptScreen.tsx:283-285 -- <h1 id="prompt-text">{promptText}</h1>
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'You went from managing fast food in New York to IT systems analysis at SMU in Dallas. What happened in between that made that jump feel logical?',
        }),
      ).toBeVisible();
    });

    // --- Step 4: type a draft into the textarea. ---
    // PromptScreen.tsx:290-296 -- <label htmlFor="prompt-response">Your
    // response</label> / <textarea id="prompt-response" ...>
    const textarea = page.getByLabel('Your response');
    await test.step('type a draft', async () => {
      await textarea.fill(DRAFT_TEXT);
      // useDraftAutosave.ts:13 -- DEBOUNCE_MS = 600; wait for the autosave to
      // fire and the status line to report it.
      // PromptScreen.tsx:414 -- describeAutosaveStatus 'saved' ->
      // 'Draft saved — not yet on the record.'
      await expect(page.getByText('Draft saved')).toBeVisible({ timeout: 5_000 });
    });

    // --- Step 5: reload the page BEFORE committing. ---
    await test.step('reload before commit', async () => {
      await page.reload();
    });

    // --- Step 6: confirm the draft survives (DESIGN 2.8). ---
    await test.step('draft text survives reload', async () => {
      await expect(textarea).toHaveValue(DRAFT_TEXT);
    });

    // --- Step 7: commit via 'Save to Record'. ---
    // PromptScreen.tsx:300-302 -- <button ...>Save to Record</button>
    await test.step('commit the draft as the first revision', async () => {
      await textarea.fill(FIRST_RESPONSE);
      const saveButton = page.getByRole('button', { name: 'Save to Record' });
      await expect(saveButton).toBeEnabled();
      await saveButton.click();
      // PromptScreen.tsx:430 -- 'committed' ->
      // 'Saved to record. Editing and saving again will create another revision.'
      await expect(page.getByText('Saved to record.')).toBeVisible();
    });

    // --- Step 8: edit the response and commit a SECOND revision. ---
    await test.step('edit and commit a second revision', async () => {
      await textarea.fill(SECOND_RESPONSE);
      const saveButton = page.getByRole('button', { name: 'Save to Record' });
      await expect(saveButton).toBeEnabled();
      await saveButton.click();
      await expect(page.getByText('Saved to record.')).toBeVisible();
    });

    // --- Step 9: open revision history; assert BOTH revisions exist. ---
    await test.step('revision history shows both revisions', async () => {
      // RevisionHistory.tsx:28-35 -- button text is
      // `Revision history (${revisions.length})`.
      const historyButton = page.getByRole('button', { name: 'Revision history (2)' });
      await expect(historyButton).toBeVisible();
      await historyButton.click();
      // RevisionHistory.tsx:43 -- <p className="revision-history__text">{revision.text}</p>
      await expect(page.getByText(FIRST_RESPONSE)).toBeVisible();
      await expect(page.getByText(SECOND_RESPONSE)).toBeVisible();
    });

    // Capture the record URL so we can return to it after clearing storage.
    const recordUrl = new URL(page.url());
    const recordHash = recordUrl.hash; // '#/record/<id>/prompt/<promptId>'
    const recordIdMatch = recordHash.match(/#\/record\/([^/]+)/);
    if (!recordIdMatch) throw new Error(`Could not parse recordId from hash: ${recordHash}`);
    const recordId = decodeURIComponent(recordIdMatch[1]);

    // --- Step 10: go to the export screen; export a Wolf record bundle. ---
    let bundlePath: string;
    await test.step('export a Wolf record bundle', async () => {
      // PromptScreen.tsx:386-388 -- "Back to record" link.
      await page.getByRole('link', { name: 'Back to record' }).click();
      // RecordHomeScreen.tsx:169-171 -- "Export & data" button.
      await page.getByRole('button', { name: 'Export & data' }).click();
      // ExportScreen.tsx:236 -- <h1>Export and data</h1>
      await expect(page.getByRole('heading', { level: 1, name: 'Export and data' })).toBeVisible();

      // ExportScreen.tsx:265-267 -- "Download Wolf record bundle (.wolfrecord.json)"
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download Wolf record bundle (.wolfrecord.json)' }).click();
      const download = await downloadPromise;
      bundlePath = testInfo.outputPath('exported.wolfrecord.json');
      await download.saveAs(bundlePath);

      const bundleJson = JSON.parse(readFileSync(bundlePath, 'utf8')) as {
        recordId: string;
        responses: Array<{ promptId: string; revisions: Array<{ text: string }> }>;
      };
      expect(bundleJson.recordId).toBe(recordId);
      const promptResponse = bundleJson.responses.find((r) =>
        r.revisions.some((rev) => rev.text === SECOND_RESPONSE),
      );
      expect(promptResponse).toBeTruthy();
      expect(promptResponse?.revisions.map((r) => r.text)).toEqual([FIRST_RESPONSE, SECOND_RESPONSE]);
    });

    // --- Step 11: clear application data (IndexedDB). ---
    // `context.clearCookies()` does not touch IndexedDB. We delete the
    // 'AXMWolf' database directly (src/storage/db.ts DB_NAME = 'AXMWolf')
    // and reload, which genuinely empties storage for this origin -- the app
    // then re-bootstraps from scratch (re-installing the bundled pack but
    // with no records).
    await test.step('clear application data (IndexedDB)', async () => {
      await page.evaluate(() => {
        return new Promise<void>((resolve, reject) => {
          const req = indexedDB.deleteDatabase('AXMWolf');
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error ?? new Error('deleteDatabase failed'));
          req.onblocked = () => resolve();
        });
      });
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Create a record' })).toBeVisible();
      // The record from step 2 must be gone.
      await expect(page.getByText("Continue “The Wolf's Deposition”")).toHaveCount(0);
    });

    // --- Step 12: import the bundle (ExportScreen import file input). ---
    await test.step('import the exported bundle', async () => {
      // LaunchScreen has no direct export-screen link without a record;
      // navigate to a fresh record's export screen isn't valid (no record).
      // Import lives on ExportScreen, which requires an existing recordId in
      // the route. Create a placeholder record first, then use its export
      // screen's import control -- ExportScreen.tsx's handleImportFile
      // either replaces/copies based on recordId, so importing the original
      // bundle (with the ORIGINAL recordId) onto a fresh DB with no
      // conflicting record will just save it directly under that recordId.
      await page.getByRole('button', { name: "New record from The Wolf's Deposition" }).click();
      await page.getByRole('button', { name: 'Export & data' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Export and data' })).toBeVisible();

      // ExportScreen.tsx:291-292 -- <label htmlFor="import-file">Import a
      // Wolf record bundle (.json)</label> / <input id="import-file"
      // type="file" ...>
      await page.getByLabel('Import a Wolf record bundle (.json)').setInputFiles(bundlePath);

      // handleImportFile (ExportScreen.tsx:127-162): no conflicting
      // recordId exists (the placeholder record has a different,
      // freshly-generated recordId), so the import saves directly and
      // navigates to `#/record/<incoming.recordId>`.
      await expect(page).toHaveURL(new RegExp(`#/record/${encodeURIComponent(recordId)}$`));
    });

    // --- Step 13: assert exact restoration. ---
    await test.step('assert exact restoration of the imported record', async () => {
      await expect(page.getByRole('heading', { level: 1, name: "The Wolf's Deposition" })).toBeVisible();
      await page.getByRole('link', { name: /The Early Years/ }).click();
      await page
        .getByText('You went from managing fast food in New York to IT systems analysis')
        .click();

      await expect(textarea).toHaveValue(SECOND_RESPONSE);

      const historyButton = page.getByRole('button', { name: 'Revision history (2)' });
      await expect(historyButton).toBeVisible();
      await historyButton.click();
      await expect(page.getByText(FIRST_RESPONSE)).toBeVisible();
      await expect(page.getByText(SECOND_RESPONSE)).toBeVisible();
    });

    // --- Step 14: set the browser context OFFLINE. ---
    // Ensure the service worker has had a chance to install/activate from
    // the online loads above (DESIGN.md 11.1/11.2) before going offline, so
    // the app shell can be served from cache.
    await test.step('wait for service worker activation, then go offline', async () => {
      await page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) return;
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg?.active) return;
        await navigator.serviceWorker.ready;
      });
      await context.setOffline(true);
    });

    // --- Step 15: reload and assert the app still loads, record reachable. ---
    await test.step('reload offline and continue capture', async () => {
      await page.reload();
      await expect(page.getByRole('heading', { level: 1, name: "The Wolf's Deposition" })).toBeVisible();
      await page.getByRole('link', { name: /The Early Years/ }).click();
      await page
        .getByText('You went from managing fast food in New York to IT systems analysis')
        .click();
      await expect(textarea).toHaveValue(SECOND_RESPONSE);
    });

    // --- Step 16: export Markdown while offline. ---
    await test.step('export Markdown while offline', async () => {
      await page.getByRole('link', { name: 'Back to record' }).click();
      await page.getByRole('button', { name: 'Export & data' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Export and data' })).toBeVisible();

      const downloadPromise = page.waitForEvent('download');
      // ExportScreen.tsx:268-270 -- "Download Markdown (.md)"
      await page.getByRole('button', { name: 'Download Markdown (.md)' }).click();
      const download = await downloadPromise;
      const mdPath = testInfo.outputPath('exported.md');
      await download.saveAs(mdPath);

      const md = readFileSync(mdPath, 'utf8');
      expect(md).toContain(
        'You went from managing fast food in New York to IT systems analysis at SMU in Dallas.',
      );
      expect(md).toContain(SECOND_RESPONSE);
    });
  });
});
