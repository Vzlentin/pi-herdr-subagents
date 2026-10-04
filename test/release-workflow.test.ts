import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("package and project declare the service-tier override after the subagent extension", async () => {
  const manifest = JSON.parse(await readFile("package.json", "utf8"));
  const settings = JSON.parse(await readFile(".pi/settings.json", "utf8"));

  assert.deepEqual(manifest.pi.extensions, [
    "./pi-extension/subagents/index.ts",
    "./pi-extension/subagents/openai-priority.ts",
  ]);
  assert.deepEqual(settings.extensions, manifest.pi.extensions.map((path: string) => `.${path}`));
});
