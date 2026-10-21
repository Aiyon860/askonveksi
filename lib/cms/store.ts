import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { unstable_cache } from "next/cache";

import { sanitizeCmsContent } from "@/lib/cms/sanitize";
import { siteContentSchemaWithRules } from "@/lib/cms/schema";
import seedContent from "@/lib/cms/seed-content.json";
import type { CmsSiteContent } from "@/lib/cms/types";

export const CMS_CACHE_TAG = "cms-content";
export const CMS_VERSION_LIMIT = 50;

export class CmsValidationError extends Error {}
export class CmsConflictError extends Error {}
export class CmsBusyError extends Error {}

function dataDir() {
  return resolve(process.env.CMS_DATA_DIR || join(process.cwd(), "data/cms"));
}

function contentPath() {
  return join(dataDir(), "content.json");
}

function versionsDir() {
  return join(dataDir(), "versions");
}

function lockPath() {
  return join(dataDir(), ".lock");
}

function cloneSeed(): CmsSiteContent {
  return structuredClone(seedContent) as unknown as CmsSiteContent;
}

function firstIssue(error: { issues: { message: string; path: readonly PropertyKey[] }[] }) {
  const issue = error.issues[0];
  if (!issue) return "Konten tidak valid.";
  const path = issue.path.length ? ` (${issue.path.map(String).join(".")})` : "";
  return `${issue.message}${path}`;
}

function parseContent(raw: unknown): CmsSiteContent {
  const parsed = siteContentSchemaWithRules.safeParse(sanitizeCmsContent(raw));
  if (!parsed.success) throw new CmsValidationError(firstIssue(parsed.error));
  return parsed.data as CmsSiteContent;
}

async function readJson(path: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function versionNumberOf(name: string) {
  return Number(name.match(/-v(\d+)\.json$/)?.[1] ?? 0);
}

async function listVersionFiles() {
  try {
    return (await readdir(versionsDir())).filter((name) => /^[0-9TZ.-]+-v\d+\.json$/.test(name));
  } catch {
    return [];
  }
}

/** Urut dari versi terbaru ke terlama. Nama file memuat stempel waktu sehingga
 * urutan versi ditentukan nomor versinya, bukan urutan abjad nama file. */
async function versionFilesNewestFirst() {
  const files = await listVersionFiles();
  return files.sort((a, b) => versionNumberOf(b) - versionNumberOf(a) || b.localeCompare(a));
}

async function readLatestValidVersion(): Promise<CmsSiteContent | null> {
  const files = await versionFilesNewestFirst();
  for (const file of files) {
    const raw = await readJson(join(versionsDir(), file));
    if (!raw) continue;
    try {
      return parseContent(raw);
    } catch {
      continue;
    }
  }
  return null;
}

async function loadContentFromDisk(): Promise<CmsSiteContent> {
  const raw = await readJson(contentPath());
  if (!raw) return cloneSeed();
  try {
    return parseContent(raw);
  } catch (error) {
    const latest = await readLatestValidVersion();
    if (latest) return latest;
    console.error("[cms] konten tidak valid, memakai seed:", error);
    return cloneSeed();
  }
}

export const getSiteContent = unstable_cache(loadContentFromDisk, ["cms-site-content"], {
  tags: [CMS_CACHE_TAG],
  revalidate: false,
});

export async function readSiteContent() {
  return loadContentFromDisk();
}

async function withLock<T>(task: () => Promise<T>) {
  await mkdir(dataDir(), { recursive: true });
  await mkdir(versionsDir(), { recursive: true });
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      handle = await open(lockPath(), "wx");
      await handle.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await new Promise((resolveWait) => setTimeout(resolveWait, 50));
    }
  }
  if (!handle) throw new CmsBusyError("Penyimpanan sedang dipakai. Coba lagi sebentar.");
  try {
    return await task();
  } finally {
    await handle.close().catch(() => undefined);
    await unlink(lockPath()).catch(() => undefined);
  }
}

async function writeAtomic(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  const handle = await open(temp, "w");
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temp, path);
}

async function writeSnapshot(content: CmsSiteContent) {
  const stamp = content.updatedAt.replace(/[:.]/g, "-");
  const file = join(versionsDir(), `${stamp}-v${content.version}.json`);
  await writeFile(file, `${JSON.stringify(content, null, 2)}\n`, "utf8");
  const files = await versionFilesNewestFirst();
  await Promise.all(
    files.slice(CMS_VERSION_LIMIT).map((old) => unlink(join(versionsDir(), old)).catch(() => undefined)),
  );
}

export type SaveActor = { id: string; name: string };

export async function saveSiteContent(input: unknown, expectedVersion: number, actor: SaveActor) {
  const parsed = parseContent(input);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw new CmsValidationError("Versi konten tidak valid. Muat ulang halaman.");
  }

  return withLock(async () => {
    const current = await loadContentFromDisk();
    if (current.version !== expectedVersion) {
      throw new CmsConflictError("Konten sudah diubah di tab lain. Muat ulang halaman sebelum menyimpan lagi.");
    }

    const next: CmsSiteContent = {
      ...parsed,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: { id: actor.id, name: actor.name },
    };

    await writeSnapshot(current);
    await writeAtomic(contentPath(), next);
    return next;
  });
}

export async function restoreSiteContent(file: string, actor: SaveActor) {
  if (!/^[0-9TZ.-]+-v\d+\.json$/.test(file)) {
    throw new CmsValidationError("Berkas versi tidak valid.");
  }
  const raw = await readJson(join(versionsDir(), file));
  if (!raw) throw new CmsValidationError("Versi yang dipilih tidak ditemukan.");
  const snapshot = parseContent(raw);
  const current = await loadContentFromDisk();
  return saveSiteContent(snapshot, current.version, actor);
}

export async function listContentVersions() {
  const files = (await versionFilesNewestFirst()).slice(0, CMS_VERSION_LIMIT);
  const result: { file: string; version: number; updatedAt: string; updatedBy: string }[] = [];
  for (const file of files) {
    const raw = await readJson(join(versionsDir(), file));
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<CmsSiteContent>;
    result.push({
      file,
      version: Number(item.version ?? 0),
      updatedAt: String(item.updatedAt ?? ""),
      updatedBy: String(item.updatedBy?.name ?? "Tidak diketahui"),
    });
  }
  return result;
}

export async function readContentVersion(file: string) {
  if (!/^[0-9TZ.-]+-v\d+\.json$/.test(file)) return null;
  const raw = await readJson(join(versionsDir(), file));
  if (!raw) return null;
  try {
    return parseContent(raw);
  } catch {
    return null;
  }
}

export async function ensureCmsStorage() {
  await mkdir(dataDir(), { recursive: true });
  await mkdir(versionsDir(), { recursive: true });
  try {
    await stat(contentPath());
  } catch {
    await writeAtomic(contentPath(), cloneSeed());
  }
}

export async function cmsStorageInfo() {
  return { dataDir: dataDir(), content: contentPath(), versions: versionsDir() };
}
