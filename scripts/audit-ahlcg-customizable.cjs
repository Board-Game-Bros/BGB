// Runtime regression: serve the repository locally, then run with Playwright installed.
// BGB_BASE_URL and PLAYWRIGHT_MODULE optionally select the server and module location.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const base = process.env.BGB_BASE_URL || 'http://127.0.0.1:8766';
const elders = 'inscription_of_the_elders.1';
const hunt = 'inscription_of_the_hunt.1';
const ids = value => (value || '').split(',').filter(Boolean).sort();

async function openPage(browser, slug, width) {
  const page = await browser.newPage({ viewport: { width, height: 950 } });
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  // Exercise authentication without using the real password or cloud sync.
  await page.route('**/assets/data/arkham_*.json', route => {
    const file = path.join(root, new URL(route.request().url()).pathname);
    if (!fs.existsSync(file)) return route.continue();
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (data.upgradeManager) {
      data.upgradeManager.editPassword = 'audit';
      data.upgradeManager.remoteSync = null;
      page.storageKey = data.upgradeManager.storageKey;
    }
    return route.fulfill({ json: data });
  });
  page.on('dialog', dialog => dialog.accept('audit'));
  await page.goto(`${base}/games/ahlcg/${slug}/`);
  await page.locator('.customized-card-item').first().waitFor();
  return page;
}
function entry(page, uid) { return page.locator(`[data-entry-uid="${uid}"]`); }
function row(page, uid, editing = false) {
  return entry(page, uid).locator(editing
    ? '.upgrade-entry-editor .customized-card-item'
    : ':scope > .customized-section .customized-card-item').first();
}
async function assertState(page, uid, inherited, added, editing = false) {
  const data = await row(page, uid, editing).evaluate(x => ({ ...x.dataset }));
  assert.deepEqual(ids(data.customizableInheritedIds), [...inherited].sort(), `${uid}: Existing`);
  assert.deepEqual(ids(data.customizableUpgradeIds), [...added].sort(), `${uid}: This Upgrade`);
  const effective = [...new Set([...inherited, ...added])].sort();
  assert.deepEqual(ids(data.customizableEffectiveIds), effective, `${uid}: effective`);
  assert.deepEqual(ids(data.customizableSnapshotIds), effective, `${uid}: snapshot`);
  // Verify presentation as well as the stored purchase list (the original bug
  // cleared purchases while silently retaining a locked box in the snapshot).
  const flags = await row(page, uid, editing).locator('.card-ref .customizable-box').evaluateAll(xs =>
    xs.map(x => [x.classList.contains('is-inherited'), x.classList.contains('is-upgrade')]));
  assert.equal(flags.filter(x => x[0]).length, inherited.length);
  assert.equal(flags.filter(x => x[1]).length, added.length);
}
async function edit(page, uid) {
  await entry(page, uid).locator('[data-action="edit-entry"]').click();
  await row(page, uid, true).getByRole('button', { name: 'Checkboxes', exact: true }).click();
}
async function toggle(page, label) {
  await page.locator('.customizable-popover').getByRole('button', { name: label, exact: true }).click();
}
async function save(page, uid) {
  await page.getByRole('button', { name: 'Close customizable editor', exact: true }).click();
  await entry(page, uid).locator('[data-action="save-edit"]').click();
  const error = entry(page, uid).locator('[data-edit-error]');
  if (await error.count()) assert.equal(await error.textContent(), '', 'Save validation');
  await entry(page, uid).locator('.upgrade-entry-editor').waitFor({ state: 'detached' });
}
async function xp(page) {
  return entry(page, 'e9').locator('xpath=ancestor::*[contains(@class,"upgrade-card")]').locator('.xp-line').textContent();
}

async function checkRefreshDuringEdit(browser, slug, uid, width) {
  const page = await openPage(browser, slug, width);
  const target = row(page, uid);
  const committed = await target.evaluate(x => ({ ...x.dataset }));
  const card = entry(page, uid).locator('xpath=ancestor::*[contains(@class,"upgrade-card")]');
  const originalXp = await card.locator('.xp-line').textContent();
  await page.getByRole('button', { name: 'Edit Page', exact: true }).click();
  await edit(page, uid);
  await page.locator('.customizable-popover .customizable-inline-chip:not(:disabled)').first().click();
  // Force the exact unload-save path before its debounce can run.
  const saved = await page.evaluate(key => {
    window.dispatchEvent(new Event('beforeunload'));
    return JSON.parse(localStorage.getItem(key));
  }, page.storageKey);
  assert(!Object.values(saved.state).some(html => /class="(?:upgrade-columns|customized-section|entry-actions)"[^>]*style="[^"]*display:\s*none/.test(html)), 'Persisted an editor-only hidden display layer');
  const client = await page.context().newCDPSession(page);
  await Promise.all([
    page.waitForNavigation(),
    client.send('Page.reload', { ignoreCache: true }),
  ]);
  await page.getByRole('button', { name: 'Edit Page', exact: true }).waitFor();
  assert(await target.isVisible(), `${slug}: customized card disappeared after forced reload`);
  assert(await entry(page, uid).locator(':scope > .upgrade-columns').isVisible());
  assert.deepEqual(await target.evaluate(x => ({ ...x.dataset })), committed, 'Unconfirmed edits changed committed state');
  assert.equal(await card.locator('.xp-line').textContent(), originalXp);

  // Old browser snapshots already contain display:none. Seed one on the next
  // document load, after beforeunload has finished, so this really tests recovery.
  const corrupted = await page.evaluate(({ saved, uid }) => {
    for (const name of Object.keys(saved.state)) {
      const wrap = document.createElement('div');
      wrap.innerHTML = saved.state[name];
      const entry = wrap.querySelector(`[data-entry-uid="${uid}"]`);
      if (!entry) continue;
      for (const child of entry.children) {
        if (child.matches('.upgrade-columns, .customized-section, .entry-actions')) child.style.display = 'none';
      }
      saved.state[name] = wrap.innerHTML;
    }
    return saved;
  }, { saved, uid });
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: page.storageKey, value: corrupted });
  await page.reload();
  await page.getByRole('button', { name: 'Edit Page', exact: true }).waitFor();
  assert(await target.isVisible(), `${slug}: old hidden snapshot not repaired`);
  assert(await entry(page, uid).locator(':scope > .upgrade-columns').isVisible());
  assert.deepEqual(await target.evaluate(x => ({ ...x.dataset })), committed);
  assert.equal(await card.locator('.xp-line').textContent(), originalXp);
  assert.deepEqual(page.errors, []);
  console.log(`${slug} ${width}px: immediate forced refresh and old hidden-cache recovery passed`);
  await page.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [slug, uid] of [['tde_20260503', 'e20'], ['tsk_20261031', 'e9'], ['tic_20260606', 'e18']]) {
      for (const width of [1440, 390]) await checkRefreshDuringEdit(browser, slug, uid, width);
    }
    for (const width of [1440, 390]) {
      const page = await openPage(browser, 'tsk_20261031', width);
      const originalXp = await xp(page);
      await assertState(page, 'e9', [], [elders]);
      await page.getByRole('button', { name: 'Edit Page', exact: true }).click();
      await edit(page, 'e9');
      for (let repeat = 0; repeat < 2; repeat++) {
        await toggle(page, 'Inscription of the Hunt: 1');
        await assertState(page, 'e9', [], [elders, hunt], true);
        await toggle(page, 'Inscription of the Hunt: 1');
        await assertState(page, 'e9', [], [elders], true);
        assert.equal(await xp(page), originalXp);
        assert(!await row(page, 'e9', true).locator('.customizable-row-summary').textContent().then(x => x.includes('Hunt')));
      }
      await toggle(page, 'Scriptweaver: 4');
      await assertState(page, 'e9', [], [elders, ...[1, 2, 3, 4].map(n => `scriptweaver.${n}`)], true);
      await toggle(page, 'Scriptweaver: 2');
      await assertState(page, 'e9', [], [elders, 'scriptweaver.1', 'scriptweaver.2'], true);
      await toggle(page, 'Scriptweaver: 2');
      await assertState(page, 'e9', [], [elders], true);
      await save(page, 'e9');
      await assertState(page, 'e9', [], [elders]);
      assert.equal(await xp(page), originalXp);

      // An earlier purchase becomes Existing only in subsequent entries.
      await edit(page, 'e5');
      const beforeXpInput = entry(page, 'e5').locator('[data-edit="xp"]');
      const beforeXp = Number(await beforeXpInput.inputValue());
      await beforeXpInput.fill(String(beforeXp + 1));
      await toggle(page, 'Inscription of the Hunt: 1');
      await save(page, 'e5');
      await assertState(page, 'e5', [], [hunt]);
      await assertState(page, 'e9', [hunt], [elders]);
      await edit(page, 'e9');
      assert(await page.locator('.customizable-popover').getByRole('button', { name: 'Inscription of the Hunt: 1', exact: true }).isDisabled());
      await save(page, 'e9');
      await edit(page, 'e5');
      await entry(page, 'e5').locator('[data-edit="xp"]').fill(String(beforeXp));
      await toggle(page, 'Inscription of the Hunt: 1');
      await save(page, 'e5');
      await assertState(page, 'e9', [], [elders]);
      assert.equal(await xp(page), originalXp);

      await page.waitForFunction(key => !!localStorage.getItem(key), page.storageKey);
      await page.waitForTimeout(200); // local-save debounce
      // Reproduce the old persisted corruption without changing repository data.
      const staleCheckboxes = await page.evaluate(({ key, hunt, elders }) => {
        const envelope = JSON.parse(localStorage.getItem(key));
        const name = Object.keys(envelope.state).find(x => x.includes('William Yorick'));
        const container = document.createElement('div');
        container.innerHTML = envelope.state[name];
        const row = container.querySelector('[data-entry-uid="e9"] .customized-card-item');
        row.dataset.customizableInheritedIds = hunt;
        row.dataset.customizableSnapshotIds = `${hunt},${elders}`;
        row.dataset.customizableEffectiveIds = `${hunt},${elders}`;
        envelope.state[name] = container.innerHTML;
        return envelope;
      }, { key: page.storageKey, hunt, elders });
      await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
        { key: page.storageKey, value: staleCheckboxes });
      await page.reload();
      await row(page, 'e9').waitFor();
      await assertState(page, 'e9', [], [elders]);
      assert.equal(await xp(page), originalXp);
      assert.deepEqual(page.errors, []);
      console.log(`Scarlet Keys ${width}px: cancel/reselect, partial upgrades, history, XP, cached recovery passed`);
      await page.close();
    }
    const page = await openPage(browser, 'tde_20260503', 1440);
    await assertState(page, 'e9', ['pry_bar.1', 'signal_mirror.1'],
      ['signal_mirror.2', ...[1, 2, 3, 4].map(n => `spring_loaded.${n}`)]);
    await page.getByRole('button', { name: 'Edit Page', exact: true }).click();
    await edit(page, 'e9');
    await toggle(page, 'Signal Mirror: 2');
    await assertState(page, 'e9', ['pry_bar.1', 'signal_mirror.1'],
      [1, 2, 3, 4].map(n => `spring_loaded.${n}`), true);
    assert(await page.locator('.customizable-popover').getByRole('button', { name: 'Signal Mirror: 1', exact: true }).isDisabled());
    await save(page, 'e9');
    await assertState(page, 'e12', ['pry_bar.1', 'signal_mirror.1', ...[1, 2, 3, 4].map(n => `spring_loaded.${n}`)], []);
    assert.deepEqual(page.errors, []);
    console.log('Dream-Eaters: campaign-start and Refine boxes stay free/locked; canceled purchase leaves future entries');
    await page.close();
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
