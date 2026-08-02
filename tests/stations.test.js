import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsvLine, normalizeStation } from "../server/lib/stations.js";

test("parseCsvLine handles quoted commas", () => {
  const line = 'id,"name, with comma",value';
  const parsed = parseCsvLine(line);
  assert.deepEqual(parsed, ["id", "name, with comma", "value"]);
});

test("parseCsvLine handles simple CSV", () => {
  const line = "1,2,3";
  const parsed = parseCsvLine(line);
  assert.deepEqual(parsed, ["1", "2", "3"]);
});

test("normalizeStation formats ID and types", () => {
  const raw = {
    id: "75001",
    name: "Paris",
    station_type: "0",
    lat: "48.85",
    lon: "2.35",
    is_open: "true"
  };
  const normalized = normalizeStation(raw);
  assert.equal(normalized.id, "00075001");
  assert.equal(normalized.type, 0);
  assert.equal(normalized.isOpen, true);
});
