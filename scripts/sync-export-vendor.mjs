import { copyFile, mkdir } from "node:fs/promises";

// Worker export Excel memuat ExcelJS lewat importScripts, jadi bundle browser
// harus tersedia sebagai aset statis. Dijalankan otomatis oleh predev/prebuild.
const root = new URL("..", import.meta.url);
const source = new URL("node_modules/exceljs/dist/exceljs.min.js", root);
const targetDirectory = new URL("public/vendor/", root);
const target = new URL("exceljs.min.js", targetDirectory);

await mkdir(targetDirectory, { recursive: true });
await copyFile(source, target);
console.log("Vendor ExcelJS untuk Web Worker export siap: public/vendor/exceljs.min.js");
