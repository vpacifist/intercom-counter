import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const target = process.argv[2];
const supportedTargets = new Set(["firefox", "chrome"]);

if (!supportedTargets.has(target)) {
  console.error("Usage: node tools/validate-extension.js <firefox|chrome>");
  process.exit(1);
}

const rootManifest = readJson(resolve("manifest.json"));
const packageJson = readJson(resolve("package.json"));
const lockJson = readJson(resolve("package-lock.json"));
const manifest = readJson(resolve("dist", target, "manifest.json"));
const errors = [];

if (manifest.version !== rootManifest.version) {
  errors.push(`dist/${target}/manifest.json version does not match root manifest.json`);
}

if (rootManifest.version !== packageJson.version || rootManifest.version !== lockJson.version) {
  errors.push("manifest.json, package.json, and package-lock.json versions must match");
}

for (const path of [
  manifest.action?.default_popup,
  ...Object.values(manifest.icons || {}),
  ...(manifest.content_scripts || []).flatMap((script) => script.js || []),
  ...(manifest.web_accessible_resources || []).flatMap((entry) => entry.resources || [])
]) {
  if (path && !existsSync(resolve("dist", target, path))) {
    errors.push(`Missing referenced file in dist/${target}: ${path}`);
  }
}

if (target === "chrome") {
  if (!manifest.background?.service_worker) {
    errors.push("Chrome manifest must define background.service_worker");
  }

  if (manifest.background?.scripts) {
    errors.push("Chrome manifest must not define background.scripts");
  }

  if (manifest.browser_specific_settings) {
    errors.push("Chrome manifest must not include browser_specific_settings");
  }
}

if (target === "firefox") {
  if (!manifest.background?.scripts?.length) {
    errors.push("Firefox manifest must define background.scripts");
  }

  if (!manifest.browser_specific_settings?.gecko?.id) {
    errors.push("Firefox manifest must include browser_specific_settings.gecko.id");
  }
}

if (errors.length > 0) {
  console.error(`Validation failed for ${target}:`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Validated ${target} extension package structure.`);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
