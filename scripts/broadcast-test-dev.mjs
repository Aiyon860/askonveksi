import { spawn } from "node:child_process";
import { config } from "dotenv";

import { assertBroadcastTestDatabase } from "./broadcast-test-config.mjs";

const result = config({ path: ".env.broadcast-test", override: true, quiet: true });
if (result.error) throw result.error;
assertBroadcastTestDatabase();

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", ...process.argv.slice(2)], { env: process.env, stdio: "inherit" });
child.once("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
child.once("exit", (code) => process.exit(code ?? 1));
