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

(async () => {
  const browser = await chromium.launch();
  try {
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
      await page.evaluate(({ key, hunt, elders }) => {
        const envelope = JSON.parse(localStorage.getItem(key));
        const name = Object.keys(envelope.state).find(x => x.includes('William Yorick'));
        const container = document.createElement('div');
        container.innerHTML = envelope.state[name];
        const row = container.querySelector('[data-entry-uid="e9"] .customized-card-item');
        row.dataset.customizableInheritedIds = hunt;
        row.dataset.customizableSnapshotIds = `${hunt},${elders}`;
        row.dataset.customizableEffectiveIds = `${hunt},${elders}`;
        envelope.state[name] = container.innerHTML;
        localStorage.setItem(key, JSON.stringify(envelope));
      }, { key: page.storageKey, hunt, elders });
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
