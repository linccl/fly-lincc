import net from "node:net";

export async function findAvailablePort(host: string, preferredPort: number, maxAttempts: number) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const port = preferredPort + attempt;
    if (await canListen(host, port)) return port;
  }
  throw new Error(
    `No available port found from ${preferredPort} to ${preferredPort + maxAttempts - 1}.`
  );
}

function canListen(host: string, port: number) {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();

    server.once("error", () => resolve(false));
    server.listen({ host, port }, () => {
      server.close(() => resolve(true));
    });
  });
}
