// node --test scripts/starters.test.mjs — the zip writer and the starters contract.

import assert from "node:assert/strict";
import { test } from "node:test";
import { checkStarters, isSafeRelative, publishedIndex, readManifest, verifyRelease } from "./starters.mjs";
import { crc32, readZip, sha256, writeZip } from "./zip.mjs";

const file = (name, text) => ({ name, data: Buffer.from(text, "utf8") });

test("crc32 matches the standard check value", () => {
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
});

test("a zip reads back what was written, in name order", () => {
  const zip = writeZip([file("b/x.txt", "bee"), file("a.txt", "ay ".repeat(200))]);
  const back = readZip(zip);
  assert.deepEqual(
    back.map((e) => [e.name, e.data.toString()]),
    [
      ["a.txt", "ay ".repeat(200)],
      ["b/x.txt", "bee"],
    ],
  );
});

test("the same files give the same bytes, whatever order they come in", () => {
  const one = writeZip([file("a", "1"), file("b", "2")]);
  const two = writeZip([file("b", "2"), file("a", "1")]);
  assert.equal(sha256(one), sha256(two));
});

test("a path that could leave its folder is not safe", () => {
  for (const ok of ["widget", "dist/widget.json", "src/lib/colibri.js"]) assert.ok(isSafeRelative(ok), ok);
  for (const bad of ["", "/abs", "../up", "a/../b", "a//b", "./a", "c:/x", "a\\b"]) assert.ok(!isSafeRelative(bad), bad);
});

const manifest = (extra = {}) =>
  JSON.stringify({ id: "colibri-starter-x", version: "1.0.0", entry: "index.html", surfaces: ["slot"], permissions: ["marketData"], ...extra });

test("a manifest that names its widget is refused: Nest owns the name", () => {
  assert.match(readManifest(manifest({ name: "X" }), { dev: false }).problems.join(), /"name" belongs to Nest/);
});

test("a dev-server entry is allowed only in a dev manifest", () => {
  const dev = manifest({ entry: "http://localhost:5173" });
  assert.deepEqual(readManifest(dev, { dev: true }).problems, []);
  assert.match(readManifest(dev, { dev: false }).problems.join(), /entry/);
});

const starter = (extra = {}) => ({
  key: "x",
  title: { ru: "Икс", en: "X" },
  description: { ru: "Описание", en: "Description" },
  path: "starters/x",
  build: null,
  serve: "widget",
  manifests: ["widget/widget.json"],
  packageJson: null,
  edit: "widget/index.html",
  ...extra,
});
const reader = (files) => async (rel) => (rel in files ? files[rel] : null);

test("a sound starter passes and its facts come from the served manifest", async () => {
  const { problems, facts } = await checkStarters(
    { schemaVersion: 1, starters: [starter()] },
    reader({ "starters/x/widget/widget.json": manifest({ minColibriVersion: "1.4.0" }), "starters/x/widget/index.html": "<html>" }),
  );
  assert.deepEqual(problems, []);
  assert.deepEqual(facts.x, { id: "colibri-starter-x", needsNode: false, minColibriVersion: "1.4.0", minApiVersion: 1 });
});

test("a Vite starter's served manifest is checked from public/ before the build", async () => {
  const s = starter({ build: "vite", serve: "dist", manifests: ["public/widget.json", "dist/widget.json"], edit: "src/App.tsx" });
  const { problems, facts } = await checkStarters(
    { schemaVersion: 1, starters: [s] },
    reader({ "starters/x/public/widget.json": manifest(), "starters/x/src/App.tsx": "" }),
  );
  assert.deepEqual(problems, []);
  assert.equal(facts.x.needsNode, true);
});

test("manifests that disagree on the id are a problem", async () => {
  const s = starter({ manifests: ["widget/widget.json", "dev/widget.json"] });
  const { problems } = await checkStarters(
    { schemaVersion: 1, starters: [s] },
    reader({
      "starters/x/widget/widget.json": manifest(),
      "starters/x/dev/widget.json": manifest({ id: "other", entry: "http://localhost:5173" }),
      "starters/x/widget/index.html": "",
    }),
  );
  assert.match(problems.join(), /disagrees/);
});

test("the served manifest must be listed", async () => {
  const { problems } = await checkStarters({ schemaVersion: 1, starters: [starter({ manifests: ["dev/widget.json"] })] }, reader({}));
  assert.match(problems.join(), /must include widget\/widget.json/);
});

test("the published index carries what a terminal reads, and no build details", () => {
  const index = publishedIndex(
    { schemaVersion: 1, starters: [starter()] },
    { x: { id: "colibri-starter-x", needsNode: false, minColibriVersion: null, minApiVersion: 1 } },
    { release: "starters-1.0.0", sdkCommit: "abc", hashes: { x: "f".repeat(64) } },
  );
  assert.equal(index.release, "starters-1.0.0");
  assert.equal(index.starters[0].asset, "starter-x.zip");
  assert.equal(index.starters[0].needsNode, false);
  assert.ok(!("path" in index.starters[0]) && !("build" in index.starters[0]));
});

test("a release whose zip does not match its hash is caught", async () => {
  const zip = writeZip([file("widget/widget.json", manifest()), file("widget/index.html", "<html>")]);
  const entry = { ...starter(), asset: "starter-x.zip", sha256: sha256(zip), needsNode: false, minColibriVersion: null, minApiVersion: 1 };
  delete entry.path;
  delete entry.build;
  const index = { schemaVersion: 1, release: "starters-1.0.0", starters: [entry] };
  assert.deepEqual(await verifyRelease(index, async () => zip), []);
  const tampered = writeZip([file("widget/widget.json", manifest()), file("widget/index.html", "<html>evil")]);
  assert.match((await verifyRelease(index, async () => tampered)).join(), /sha256 does not match/);
});
