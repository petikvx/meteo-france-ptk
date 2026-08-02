import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeObservation } from "../server/lib/dpobs.js";

test("normalizeObservation converts Kelvin to Celsius", () => {
  const raw = {
    t: 273.15 + 20, // 20°C
    u: 50,
    ff: 10 // 10 m/s
  };
  const normalized = normalizeObservation(raw);
  assert.equal(normalized.temperature, 20);
});

test("normalizeObservation converts m/s to km/h", () => {
  const raw = {
    ff: 10 // 10 m/s = 36 km/h
  };
  const normalized = normalizeObservation(raw);
  assert.equal(normalized.windSpeed, 36);
});

test("normalizeObservation handles nested properties (GeoJSON-like)", () => {
  const raw = {
    properties: {
      t: 273.15 + 15
    }
  };
  const normalized = normalizeObservation(raw);
  assert.equal(normalized.temperature, 15);
});
