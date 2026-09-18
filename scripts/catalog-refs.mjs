#!/usr/bin/env node
// Reads services.js (a browser global, no module system) and emits one JSON
// line per catalog entry — every top-level service plus its dependsOn
// companions — with just what the catalog-drift workflow needs to check:
// {key, name, image, sourceUrl, sourceHash}. sourceUrl/sourceHash are
// optional per entry (see README's "Adding a new service"); entries
// without them just get the image-existence check, not the source-diff one.
//
// Usage: node scripts/catalog-refs.mjs [path/to/services.js]

import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const servicesPath = process.argv[2] || join(here, "..", "services.js");
const src = readFileSync(servicesPath, "utf8");

// services.js is written to run as a plain <script> tag — no exports. Eval
// it in an isolated vm context (not this process's globals) and pull SERVICES
// back out via a `var` (which, unlike `const`/`let`, becomes a real property
// on the context's global object and so is visible after the eval returns).
const sandbox = {};
createContext(sandbox);
runInContext(`${src}\nvar __CATALOG_REFS_EXPORT__ = SERVICES;`, sandbox, { filename: servicesPath });
const SERVICES = sandbox.__CATALOG_REFS_EXPORT__;

if (!SERVICES || typeof SERVICES !== "object") {
  console.error("catalog-refs: couldn't find SERVICES in", servicesPath);
  process.exit(1);
}

function emit(key, name, def) {
  if (!def || !def.image) return; // dependencies always have one; be defensive anyway
  console.log(
    JSON.stringify({
      key,
      name: name || key,
      image: def.image,
      sourceUrl: def.sourceUrl || null,
      sourceHash: def.sourceHash || null,
    })
  );
}

for (const [key, def] of Object.entries(SERVICES)) {
  emit(key, def.name, def);
  for (const dep of def.dependsOn || []) {
    emit(dep.key, dep.name, dep);
  }
}
