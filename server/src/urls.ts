import os from "node:os";

export function getLanUrls(port: number) {
  const urls: string[] = [];
  const ifaces = os.networkInterfaces();

  for (const list of Object.values(ifaces)) {
    if (!list) continue;
    for (const info of list) {
      if (info.family !== "IPv4") continue;
      if (info.internal) continue;
      urls.push(`http://${info.address}:${port}/`);
    }
  }

  urls.sort();
  return urls;
}

