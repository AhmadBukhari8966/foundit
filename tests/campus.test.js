import test from "node:test";
import assert from "node:assert/strict";
import { buildings, getBuilding, walkingDirections } from "../src/campus.js";

test("campus buildings have unique identities and marker positions within the supplied map", () => {
  assert.equal(buildings.length, 23);
  assert.equal(new Set(buildings.map((b) => b.name)).size, buildings.length);
  assert.equal(new Set(buildings.map((b) => b.id)).size, buildings.length);
  for (const b of buildings) {
    assert.ok(Number.isFinite(b.x) && b.x > 0 && b.x < 100, b.name);
    assert.ok(Number.isFinite(b.y) && b.y > 0 && b.y < 100, b.name);
  }
});
test("walking directions point to the selected Truman building without inventing a GPS origin", () => {
  const b = getBuilding("Pickler Memorial Library");
  assert.ok(b);
  const url = new URL(walkingDirections(b.name));
  assert.equal(url.origin, "https://www.google.com");
  assert.equal(url.searchParams.get("travelmode"), "walking");
  assert.equal(url.searchParams.get("api"), "1");
  assert.equal(
    url.searchParams.get("destination"),
    "Pickler Memorial Library, Truman State University, Kirksville, Missouri",
  );
  assert.equal(url.searchParams.has("origin"), false);
});
test("legacy unknown locations do not get a fabricated map pin or directions", () => {
  assert.equal(getBuilding("Engineering Hall"), null);
  assert.equal(walkingDirections("Engineering Hall"), null);
  assert.equal(walkingDirections(""), null);
});
