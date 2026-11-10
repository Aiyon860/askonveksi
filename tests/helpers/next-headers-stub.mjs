/**
 * Stub `next/headers` untuk unit test di luar runtime Next.
 *
 * Modul server (mis. session/prisma extension) mengimpor `cookies()` dan
 * `headers()`, tetapi test hanya memanggil fungsi murni sehingga keduanya
 * tidak boleh dieksekusi. Bila dieksekusi, test melempar error yang jelas
 * supaya tidak menutupi ketergantungan request yang tidak disengaja.
 */
function unavailable(name) {
  throw new Error(`${name}() tidak tersedia di luar request Next.js`);
}

export async function cookies() {
  unavailable("cookies");
}

export async function headers() {
  unavailable("headers");
}

export async function draftMode() {
  unavailable("draftMode");
}
