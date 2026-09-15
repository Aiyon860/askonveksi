const databaseName = "askonveksi_broadcast_test";

export function assertBroadcastTestDatabase() {
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    const value = process.env[key];
    if (!value) throw new Error(`${key} wajib diisi untuk broadcast test.`);
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`${key} bukan URL PostgreSQL yang valid.`);
    }
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !["localhost", "127.0.0.1", "::1"].includes(url.hostname) || url.pathname.slice(1) !== databaseName) {
      throw new Error(`${key} harus menuju PostgreSQL lokal database ${databaseName}.`);
    }
  }
}

export function broadcastTestRecipients() {
  const values = (process.env.BROADCAST_TEST_RECIPIENTS || "").split(",").map((value) => value.replace(/\D/g, "")).map((value) => value.startsWith("0") ? `62${value.slice(1)}` : value);
  if (values.length !== 2 || new Set(values).size !== 2 || values.some((value) => !/^[1-9]\d{7,14}$/.test(value))) {
    throw new Error("BROADCAST_TEST_RECIPIENTS harus berisi tepat dua nomor WhatsApp unik dan valid, dipisahkan koma.");
  }
  return values;
}
