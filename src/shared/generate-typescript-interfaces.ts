import {writeFileSync, statSync, readFileSync} from "fs";

const selfPath = "generate-typescript-interfaces.js"; // we don't have __filename for some reason.
const inPath = "schema.js";
const outPath = "schema.d.ts";
const cachePath = "schema.cache.json";

let cache: {[index: string]: string} = function() {
  try {
    return JSON.parse(readFileSync(cachePath, {encoding: "utf8"}));
  } catch {
    return {};
  }
}();

function checkCache(path: string): boolean {
  let stats = statSync(path, {throwIfNoEntry: false});
  if (stats == null) return false;
  const entry = JSON.stringify([stats.ino, stats.size, stats.mtime]);
  if (cache[path] === entry) return true;

  // Optimistically put the new entry in case we get around to writing the cache.
  cache[path] = entry;
  return false;
}
function writeCache() {
  writeFileSync(cachePath, JSON.stringify(cache) + "\n");
}

if (checkCache(selfPath) && checkCache(inPath) && checkCache(outPath)) {
  // up to date.
  process.exit(0);
}

// Need to generate.
console.log("generating schema types");
import {protocolSchema} from "./schema.js"

// tsc chokes analyzing this dependency, but it works at runtime.
// Obfuscate the import to disable typescript compile-time analysis.
const {compile} = await import("" + "json-schema-to-typescript");

let content = await compile(protocolSchema, "ProtocolMessage");
writeFileSync(outPath, content);

checkCache(outPath);
writeCache();
