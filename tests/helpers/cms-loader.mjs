import { readFile } from "node:fs/promises";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), "../..");

async function resolveFile(absolute) {
  if (absolute.endsWith(".json")) {
    const contents = await readFile(absolute, "utf8");
    return { url: `data:text/javascript,export default ${encodeURIComponent(contents)}`, shortCircuit: true };
  }
  const target = /\.[mc]?[jt]s$/.test(absolute) ? absolute : `${absolute}.ts`;
  return { url: pathToFileURL(target).href, shortCircuit: true };
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/cache" || specifier === "server-only") {
    const stub = specifier === "next/cache" ? "next-cache-stub.mjs" : "server-only-stub.mjs";
    return { url: pathToFileURL(resolvePath(root, "tests/helpers", stub)).href, shortCircuit: true };
  }

  if (specifier.startsWith("@/")) {
    return resolveFile(resolvePath(root, specifier.slice(2)));
  }

  if (specifier.startsWith(".") && context.parentURL) {
    return resolveFile(fileURLToPath(new URL(specifier, context.parentURL)));
  }

  return nextResolve(specifier, context);
}
