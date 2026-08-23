import assert from "node:assert/strict";
import { test } from "node:test";
import { validateCursorInventory } from "./inventory.ts";
import { renderCursorDistribution } from "./render.ts";

function fixture() {
  const distribution = renderCursorDistribution(process.cwd(), { profile: "full" });
  const actual = new Map(
    [...distribution.plugin].map(([filePath, file]) => [filePath, { content: Buffer.from(file.content, "utf8") }]),
  );
  const inventory = JSON.parse(distribution.plugin.get("reports/inventory-sha256.json")!.content);
  return { actual, inventory };
}

test("accepts an exact, complete Cursor inventory", () => {
  const { actual, inventory } = fixture();
  assert.doesNotThrow(() => validateCursorInventory(inventory, actual));
});

test("rejects missing and duplicate inventory entries", () => {
  const missing = fixture();
  missing.inventory.files.pop();
  missing.inventory.totals.files--;
  missing.inventory.totals.bytes = missing.inventory.files.reduce(
    (total: number, file: { bytes: number }) => total + file.bytes,
    0,
  );
  assert.throws(
    () => validateCursorInventory(missing.inventory, missing.actual),
    /path set differs from generated output/,
  );

  const duplicate = fixture();
  duplicate.inventory.files.push({ ...duplicate.inventory.files[0] });
  duplicate.inventory.totals.files++;
  duplicate.inventory.totals.bytes += duplicate.inventory.files[0].bytes;
  assert.throws(
    () => validateCursorInventory(duplicate.inventory, duplicate.actual),
    /duplicate path/,
  );
});

test("rejects incorrect inventory totals", () => {
  const wrongFiles = fixture();
  wrongFiles.inventory.totals.files++;
  assert.throws(
    () => validateCursorInventory(wrongFiles.inventory, wrongFiles.actual),
    /file total differs/,
  );

  const wrongBytes = fixture();
  wrongBytes.inventory.totals.bytes++;
  assert.throws(
    () => validateCursorInventory(wrongBytes.inventory, wrongBytes.actual),
    /byte total differs/,
  );
});
