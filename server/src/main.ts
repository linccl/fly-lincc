import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { findAvailablePort } from "./port.js";
import { getLanUrls } from "./urls.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
process.chdir(PROJECT_ROOT);

async function main() {
  const config = loadConfig();
  const app = await createApp(config);

  const preferredPort = config.port;
  const port =
    config.portFallback.enabled && config.portFallback.maxAttempts > 1
      ? await findAvailablePort(config.host, preferredPort, config.portFallback.maxAttempts)
      : preferredPort;

  await app.listen({ host: config.host, port });

  const urls = getLanUrls(port);
  const lines = urls.length > 0 ? urls : [`http://127.0.0.1:${port}/`];

  app.log.info(
    {
      host: config.host,
      preferredPort,
      port,
      urls: lines
    },
    `Listening on port ${port}`
  );
}

main().catch((err) => {
  process.stderr.write(`${err?.message ?? err}\n`);
  process.exitCode = 1;
});
