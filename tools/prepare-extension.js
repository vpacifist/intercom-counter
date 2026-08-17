import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const target = process.argv[2];
const supportedTargets = new Set(["firefox", "chrome"]);

if (!supportedTargets.has(target)) {
  console.error("Usage: node tools/prepare-extension.js <firefox|chrome>");
  process.exit(1);
}

const rootDir = resolve(".");
const distRoot = resolve(rootDir, "dist");
const targetDir = resolve(distRoot, target);

if (!targetDir.startsWith(`${distRoot}\\`) && !targetDir.startsWith(`${distRoot}/`)) {
  throw new Error(`Refusing to write outside dist: ${targetDir}`);
}

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });

for (const path of ["assets", "src"]) {
  cpSync(resolve(rootDir, path), resolve(targetDir, path), { recursive: true });
}

for (const path of ["README.md", "CHANGELOG.md"]) {
  cpSync(resolve(rootDir, path), resolve(targetDir, basename(path)));
}

const manifest = JSON.parse(readFileSync(resolve(rootDir, "manifest.json"), "utf8"));
const preparedManifest = target === "chrome" ? toChromeManifest(manifest) : manifest;

writeFileSync(
  resolve(targetDir, "manifest.json"),
  `${JSON.stringify(preparedManifest, null, 2)}\n`
);

console.log(`Prepared ${target} extension in ${targetDir}`);

function toChromeManifest(manifest) {
  const nextManifest = structuredClone(manifest);
  delete nextManifest.browser_specific_settings;
  nextManifest.background = {
    service_worker: manifest.background.scripts[0],
    type: manifest.background.type
  };
  return nextManifest;
}
