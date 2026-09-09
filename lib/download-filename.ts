const APP_TIME_ZONE = "Asia/Jakarta";

function formatDownloadDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";

  return `${day}-${month}-${year}`;
}

function filenameSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "export";
}

export function downloadFilename(subject: string, extension: string, date = new Date()) {
  const safeExtension = extension.replace(/^\.+/, "").replace(/[^a-z0-9]+/gi, "").toLowerCase() || "bin";
  return `${filenameSlug(subject)}-${formatDownloadDate(date)}.${safeExtension}`;
}
