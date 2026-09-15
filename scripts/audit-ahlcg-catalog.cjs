// Run with node scripts/audit-ahlcg-catalog.cjs.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const window = { location: { pathname: '/' } };
vm.runInNewContext(read('scripts/ahlcg-standard-library.js'), { window });
const library = window.AHLCG_STANDARD_NAME_LIBRARY;
// Exercise production functions without starting UI or storage side effects.
const source = read('scripts/ahlcg-upgrade-manager.js').replace(
  'const previewBaseWidth = 420;',
  'return { normalizeCardNameInput, getInventoryCardInfo, findExactImage, findMatchingImage, toDisplayNameFromFile, getCardNameCatalog, validateRemovedCardsAgainstDeck }; const previewBaseWidth = 420;'
);
vm.runInNewContext(source, { window });
const api = window.initAhlcgUpgradeManager(library);
const collisions = library.cardImageFiles.filter(file => /_1\.png$/.test(file)
  && library.cardImageFiles.includes(file.replace(/_1\.png$/, '.png'))
  && library.cardImageFiles.includes(file.replace(/\.png$/, '_1.png')));
console.log(JSON.stringify({ images: library.cardImageFiles.length, names: library.standardCardNames.length, collisions }, null, 2));
assert.equal(api.normalizeCardNameInput('Leo De Luca'), 'Leo De Luca: The Louisiana Lion');
assert.equal(api.normalizeCardNameInput('Leo De Luca (1)'), 'Leo De Luca: The Louisiana Lion (1)');
assert.equal(api.getInventoryCardInfo({ name: 'Leo De Luca', qty: 2 }).key,
  api.getInventoryCardInfo('Leo De Luca: The Louisiana Lion').key);
assert.notEqual(api.getInventoryCardInfo('Leo De Luca').key,
  api.getInventoryCardInfo('Leo De Luca (1)').key);
assert.equal(api.findExactImage('Leo De Luca: The Louisiana Lion (1)'),
  '/assets/boardgames/ahlcg_cards/leo_de_luca_the_louisiana_lion_1_1.png');
assert.equal(api.findExactImage('Leo De Luca: The Louisiana Lion'),
  '/assets/boardgames/ahlcg_cards/leo_de_luca_the_louisiana_lion.png');
assert.equal(api.findExactImage('Leo De Luca: The Louisiana Lion (9)'), null);
assert.equal(api.findMatchingImage('Leo De Luca: The Louisiana Lion (9)'), null);
const inventoryApi = window.initAhlcgUpgradeManager({ ...library,
  initialDecks: { Preston: [{ name: 'Leo De Luca', qty: 2 }] }
});
const deck = {
  closest() { return this; },
  querySelector() { return { getAttribute: () => 'Preston' }; },
  querySelectorAll() { return []; }
};
assert.equal(inventoryApi.validateRemovedCardsAgainstDeck(deck, null,
  ['Leo De Luca: The Louisiana Lion']).valid, true);
assert.equal(inventoryApi.validateRemovedCardsAgainstDeck(deck, null,
  ['Leo De Luca: The Louisiana Lion (1)']).valid, false);
assert.equal(inventoryApi.validateRemovedCardsAgainstDeck(deck, null,
  ['Leo De Luca: The Louisiana Lion (x3)']).valid, false);
assert.equal(api.normalizeCardNameInput('Leo De Luca (9)'), 'Leo De Luca (9)');
assert.equal(api.toDisplayNameFromFile('charisma_3_core_2026.png'), 'Charisma (3)');
assert.equal(api.toDisplayNameFromFile('lockpicks_1_and.png'), 'Lockpicks (1)');
assert.notEqual(api.findExactImage('Lockpicks'), api.findExactImage('Lockpicks (1)'));
const issues = [];
const aliases = [];
const catalog = api.getCardNameCatalog();
const imageLevels = new Map();
for (const item of catalog) {
  const image = api.findExactImage(item.name);
  if (image) {
    assert.ok(fs.existsSync(path.join(root, image)), image);
    const level = Number(item.name.match(/\((\d+)\)$/)?.[1] || 0);
    if (imageLevels.has(image)) assert.equal(imageLevels.get(image), level, 'Different levels share ' + image);
    imageLevels.set(image, level);
    const inferred = api.toDisplayNameFromFile(path.basename(image));
    if (api.getInventoryCardInfo(inferred).key !== api.getInventoryCardInfo(item.name).key) {
      issues.push({ type: 'image-identity', name: item.name, image, inferred });
    }
  }
  if (item.name.includes(':')) {
    const level = item.name.match(/\(\d+\)$/)?.[0] || '';
    const alias = item.name.split(':')[0] + (level ? ' ' + level : '');
    const resolved = api.normalizeCardNameInput(alias);
    if (resolved === item.name) aliases.push({ alias, resolved });
  }
}
let deckRows = 0;
function walk(value, file) {
  if (!value || typeof value !== 'object') return;
  if (value.name && value.imageSrc && value.qty) {
    deckRows++;
    const inferred = api.toDisplayNameFromFile(path.basename(value.imageSrc));
    if (api.getInventoryCardInfo(value).key !== api.getInventoryCardInfo(inferred).key) {
      issues.push({ type: 'deck-identity', file, name: value.name, inferred, image: value.imageSrc });
    }
  }
  Object.values(value).forEach(child => walk(child, file));
}
for (const file of fs.readdirSync(path.join(root, 'assets/data')).filter(file => /^arkham.*\.json$/.test(file))) {
  walk(JSON.parse(read('assets/data/' + file)), file);
}
console.log(JSON.stringify({ catalogEntries: catalog.length, resolvedSubtitleAliases: aliases.length, deckRows, issues }, null, 2));
assert.equal(issues.length, 0, 'Card identity audit must pass');
console.log('PASS: catalog identity, level-specific previews, and all initial deck rows.');
