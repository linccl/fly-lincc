import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_DIR = path.join(PROJECT_ROOT, "config");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
const CONFIG_EXAMPLE_PATH = path.join(CONFIG_DIR, "config.example.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function ensureConfig() {
  if (fs.existsSync(CONFIG_PATH)) return readJson(CONFIG_PATH);
  if (!fs.existsSync(CONFIG_EXAMPLE_PATH)) {
    throw new Error(`Missing ${path.relative(PROJECT_ROOT, CONFIG_EXAMPLE_PATH)}`);
  }
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const data = readJson(CONFIG_EXAMPLE_PATH);
  writeJson(CONFIG_PATH, data);
  return data;
}

function base64url(buffer) {
  return buffer
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function promptHidden(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const input = process.stdin;
  const output = process.stdout;
  const wasRaw = input.isRaw;
  if (input.isTTY) input.setRawMode(true);

  let value = "";
  output.write(question);

  return await new Promise((resolve, reject) => {
    function cleanup() {
      try {
        if (input.isTTY) input.setRawMode(Boolean(wasRaw));
      } catch {
        // ignore
      }
      rl.close();
      output.write("\n");
      input.off("data", onData);
    }

    function onData(chunk) {
      const char = chunk.toString("utf8");

      if (char === "\r" || char === "\n") {
        cleanup();
        resolve(value);
        return;
      }

      if (char === "\u0003") {
        cleanup();
        reject(new Error("Cancelled"));
        return;
      }

      if (char === "\u007f") {
        value = value.slice(0, -1);
        return;
      }

      if (char >= " " && char <= "~") value += char;
    }

    input.on("data", onData);
  });
}

function hashPasswordScrypt(password) {
  const salt = crypto.randomBytes(16);
  const cost = 16384;
  const blockSize = 8;
  const parallelization = 1;
  const keylen = 32;
  const derivedKey = crypto.scryptSync(password, salt, keylen, {
    cost,
    blockSize,
    parallelization
  });

  return `scrypt$${cost}$${blockSize}$${parallelization}$${base64url(salt)}$${base64url(derivedKey)}`;
}

function ensureSessionSecret(config) {
  config.auth ??= {};
  if (typeof config.auth.sessionSecret === "string" && config.auth.sessionSecret.length >= 32) return;
  config.auth.sessionSecret = base64url(crypto.randomBytes(32));
}

async function main() {
  const config = ensureConfig();

  const password = await promptHidden("New password: ");
  const confirm = await promptHidden("Confirm password: ");

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  if (password !== confirm) {
    throw new Error("Password confirmation does not match.");
  }

  ensureSessionSecret(config);
  config.auth.passwordHash = hashPasswordScrypt(password);
  writeJson(CONFIG_PATH, config);

  process.stdout.write(`Updated ${path.relative(PROJECT_ROOT, CONFIG_PATH)}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err?.message ?? err}\n`);
  process.exitCode = 1;
});

