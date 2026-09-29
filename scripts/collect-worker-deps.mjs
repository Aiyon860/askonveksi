// CI-only: copy the node_modules closure needed by worker/whatsapp.mjs
// into the deploy package. Same source tree => identical versions.
// Standalone dirs may be FILE-pruned, so trust is per-file, never per-dir:
// - package dir absent in dest -> copy whole (keeps non-imported assets
//   like .node/.wasm next to reachable files).
// - package dir present -> merge only the traced files missing in dest.
//
// Usage: node scripts/collect-worker-deps.mjs [destDir]
// Exits non-zero when a reachable import cannot be resolved.
import {
  cpSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from "node:fs";
import { builtinModules, createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = process.cwd();
const dest = path.resolve(process.argv[2] ?? "deploy_package");
const BUILTINS = new Set(builtinModules.map((m) => m.replace(/^node:/, "")));

// Optional deps loaded inside try/catch by their importers; safe to skip.
// - @opentelemetry/api: supabase-js tracing only, works without it.
// - jimp: baileys image processing, falls back to sharp (installed).
// - audio-decode: baileys voice waveforms, feature degrades without it.
// - link-preview-js: baileys link previews, feature degrades without it.
// - bufferutil, utf-8-validate: ws native perf addons, pure-JS fallback.
// - pg-native: behind PG_NATIVE flag + try/catch.
const OPTIONAL = new Set([
  "@opentelemetry/api",
  "jimp",
  "audio-decode",
  "link-preview-js",
  "bufferutil",
  "utf-8-validate",
  "pg-native",
]);
// Platform-specific native binaries probed per-platform inside try/catch
// (only the matching platform is ever installed).
const OPTIONAL_PREFIXES = ["@img/"];

function isOptional(spec) {
  if (OPTIONAL.has(spec)) return true;
  return OPTIONAL_PREFIXES.some((prefix) => spec.startsWith(prefix));
}

const IMPORT_RE =
  /(?:import\s+(?:[^'"]*?\s+from\s+)?|export\s+[^'"]*?\s+from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;
const PARSEABLE_RE = /\.(?:mjs|cjs|js)$/;

function specifiersOf(file) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return [];
  }
  // Strip comments so words inside them are never treated as imports.
  text = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:\\])\/\/.*$/gm, "$1");
  const out = [];
  for (const m of text.matchAll(IMPORT_RE)) out.push(m[1]);
  return out;
}

function packageDirOf(abs) {
  // Directory of the package owning abs, via the LAST node_modules segment
  // (handles packages nested inside other packages).
  const parts = abs.split(path.sep);
  const idx = parts.lastIndexOf("node_modules");
  if (idx < 0) return null;
  const rest = parts.slice(idx + 1);
  if (rest.length === 0) return null;
  const depth = rest[0].startsWith("@") ? 2 : 1;
  if (rest.length < depth) return null;
  return parts.slice(0, idx + 1 + depth).join(path.sep);
}

const entry = path.join(root, "worker", "whatsapp.mjs");
if (!existsSync(entry)) {
  console.error(`entry not found: ${entry}`);
  process.exit(1);
}

const seen = new Set();
const tracedFiles = new Set(); // reachable files under root (phase 1)
const missing = [];
const queue = [entry];

while (queue.length > 0) {
  const file = queue.pop();
  if (seen.has(file)) continue;
  seen.add(file);
  if (!PARSEABLE_RE.test(file)) continue;

  for (const spec of specifiersOf(file)) {
    if (
      spec.startsWith("node:") ||
      BUILTINS.has(spec) ||
      spec.startsWith("data:") ||
      spec === "." ||
      spec === ".."
    )
      continue;
    // Dual-semantics: CJS-first, ESM as well. Dual packages (pg, pg-pool:
    // esm/index.mjs vs lib/index.js) resolve differently per importer, and
    // the worker (ESM) may hit the entry the CJS walk never sees.
    // This mirrors runtime, where ESM entries bridge to CJS via createRequire.
    const resolvedHrefs = new Set();
    try {
      resolvedHrefs.add(
        pathToFileURL(createRequire(file).resolve(spec)).href,
      );
    } catch {
      // fall through to ESM attempt below
    }
    try {
      resolvedHrefs.add(
        await import.meta.resolve(spec, pathToFileURL(file).href),
      );
    } catch {
      // fall through to missing check below
    }
    if (resolvedHrefs.size === 0) {
      if (isOptional(spec)) {
        console.warn(`optional dep skipped: ${spec}`);
        continue;
      }
      missing.push(`${path.relative(root, file)} -> ${spec}`);
      continue;
    }
    for (const resolved of resolvedHrefs) {
      if (!resolved.startsWith("file://")) continue;
      const abs = fileURLToPath(resolved);
      queue.push(abs);
      if (abs.startsWith(root + path.sep)) tracedFiles.add(abs);
    }
  }
}

// Phase 2: group traced files by owning package, then copy hybrid.
const byPkg = new Map();
for (const file of tracedFiles) {
  const pkgDir = packageDirOf(file);
  if (!pkgDir) {
    if (process.env.WORKER_DEPS_DEBUG)
      console.warn(`outside node_modules: ${file}`);
    continue;
  }
  if (!byPkg.has(pkgDir)) byPkg.set(pkgDir, new Set());
  byPkg.get(pkgDir).add(file);
}

let copiedPkgs = 0;
let mergedFiles = 0;
for (const [pkgDir, files] of byPkg) {
  const out = path.join(dest, path.relative(root, pkgDir));
  if (!existsSync(out)) {
    mkdirSync(path.dirname(out), { recursive: true });
    cpSync(pkgDir, out, { recursive: true, dereference: true });
    copiedPkgs++;
    continue;
  }
  for (const file of files) {
    const target = path.join(dest, path.relative(root, file));
    if (existsSync(target)) continue;
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(file, target);
    mergedFiles++;
  }
  // package.json carries name/version/exports; without it subpath
  // resolution inside a merged dir fails at runtime.
  const manifestOut = path.join(out, "package.json");
  if (!existsSync(manifestOut) && existsSync(path.join(pkgDir, "package.json"))) {
    copyFileSync(path.join(pkgDir, "package.json"), manifestOut);
    mergedFiles++;
  }
  copiedPkgs++;
}

if (missing.length > 0) {
  console.error("unresolvable worker imports:");
  for (const line of missing) console.error(`  ${line}`);
  process.exit(1);
}

console.log(
  `worker deps: ${byPkg.size} packages traced, ${copiedPkgs} ensured, ${mergedFiles} files merged into pruned dirs`,
);
