import { mkdirSync, rmSync } from "node:fs";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const artifactsDir = resolve("web-ext-artifacts", "chrome");
const sourceGlob = resolve("dist", "chrome", "*");
const outputPath = resolve(artifactsDir, `${packageJson.name}-${packageJson.version}-chrome.zip`);

mkdirSync(artifactsDir, { recursive: true });
rmSync(outputPath, { force: true });

execFileSync(
  "powershell",
  [
    "-NoProfile",
    "-Command",
    "Compress-Archive",
    "-Path",
    sourceGlob,
    "-DestinationPath",
    outputPath,
    "-Force"
  ],
  { stdio: "inherit" }
);

console.log(`Built Chrome package: ${outputPath}`);
