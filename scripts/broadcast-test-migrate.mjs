import { spawn } from "node:child_process";

import { assertBroadcastTestDatabase } from "./broadcast-test-config.mjs";

assertBroadcastTestDatabase();
const command = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(command, ["prisma", "migrate", "deploy"], { stdio: "inherit" });
child.once("exit", (code) => process.exit(code ?? 1));
