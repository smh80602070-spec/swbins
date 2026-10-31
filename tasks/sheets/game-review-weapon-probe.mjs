// Read-only adapter probe. Run from any directory with Node; no browser or saves.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const files = {
  mode: 'saga-web/shared/js/mode2d.js',
  actor: 'saga-web/saga-dungeon/js/actor2d.js',
  items: 'saga-web/saga-dungeon/js/data-item.js',
  manifest: 'saga-web/saga-dungeon/assets/sprites2d_sheets/elf_001/manifest.json',
};
const source = Object.fromEntries(Object.entries(files).map(([k, p]) => [k, fs.readFileSync(path.join(root, p), 'utf8')]));
const manifest = JSON.parse(source.manifest);
function context() {
  const ctx = vm.createContext({});
  ctx.window = ctx;
  for (const key of ['mode', 'items', 'actor']) vm.runInContext(source[key], ctx, { filename: files[key], timeout: 1000 });
  return ctx;
}
const weapons = context().DG.itemData.BASES.filter(b => b.slot === 'weapon');
const cases = ['idle', 'walk', 'attack', 'attack2', 'heavy', 'cast', 'broken', 'unequipped', 'town'];
const rows = [];
for (const base of weapons) for (const scenario of cases) {
  const ctx = context(), dg = ctx.DG, mode = dg.mode2d;
  let captured;
  // Only pool selection, equipment input, town state and drawing are fixtures.
  // actT/actInfo, actor2d.draw and factRole execute the repository code.
  mode.pick = () => 'elf_001';
  mode.draw = (_canvas, options) => { captured = options; return true; };
  dg.item = {
    equipped: () => ({ weapon: scenario === 'unequipped' ? null : { key: base.key } }),
    isBroken: () => scenario === 'broken',
    baseOf: () => base,
  };
  dg.town = { active: () => scenario === 'town' };
  const draw = options => dg.actor2d.draw(null, 'me', { id: 'probe' }, 0, 0, 1, options);
  if (scenario === 'attack2') { draw({ atk: 0.2 }); draw({ atk: 0 }); }
  draw({
    atk: ['idle', 'walk'].includes(scenario) ? 0 : scenario === 'heavy' ? 0.38 : 0.2,
    cast: scenario === 'cast', walking: scenario === 'walk', now: 1000,
  });
  rows.push({ item: base.key, look: base.look, scenario, requested: captured.clip,
    weaponKey: captured.wpn, selected: mode.factRole(manifest, captured.clip, captured.wpn) });
}
const report = {
  scope: 'Adapter and clip selection only; equipment, pool and drawing are fixtures. No visual or real equip-flow verdict.',
  sources: Object.fromEntries(Object.entries(files).map(([k, p]) => [p, createHash('sha256').update(source[k]).digest('hex')])),
  weaponCount: weapons.length, caseCount: rows.length, rows,
};
console.log(JSON.stringify(report, null, 2));
