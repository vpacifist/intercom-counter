import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function git(args) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "";
  }
}

const manifest = readJson("manifest.json");
const packageJson = readJson("package.json");
const lockJson = readJson("package-lock.json");
const lockRootVersion = lockJson.packages?.[""]?.version;
const versions = new Map([
  ["manifest.json", manifest.version],
  ["package.json", packageJson.version],
  ["package-lock.json", lockJson.version],
  ["package-lock root", lockRootVersion]
]);

const uniqueVersions = new Set([...versions.values()]);
const latestAmoTag = git(["describe", "--tags", "--match", "amo-v*", "--abbrev=0"]);
const head = git(["rev-parse", "--short", "HEAD"]);
const worktreeStatus = git(["status", "--short"]);

console.log(`Local HEAD: ${head || "unknown"}`);
console.log(`Local extension version: ${manifest.version}`);

if (uniqueVersions.size === 1) {
  console.log("Version files: OK");
} else {
  console.log("Version files: MISMATCH");
  for (const [file, version] of versions) {
    console.log(`  ${file}: ${version || "missing"}`);
  }
  process.exitCode = 1;
}

if (!latestAmoTag) {
  console.log("Latest AMO tag: none");
  console.log("Create an amo-vX.Y.Z tag after the first accepted AMO upload.");
  process.exit();
}

const publishedVersion = latestAmoTag.replace(/^amo-v/, "");
console.log(`Latest AMO tag: ${latestAmoTag}`);
console.log(`Latest AMO version: ${publishedVersion}`);

const commitsSince = git(["rev-list", "--count", `${latestAmoTag}..HEAD`]);
console.log(`Commits since AMO tag: ${commitsSince || "0"}`);

if (commitsSince && commitsSince !== "0") {
  console.log("");
  console.log("Unpublished commits:");
  console.log(git(["log", "--oneline", `${latestAmoTag}..HEAD`]) || "  none");
  console.log("");
  console.log("Files changed since AMO tag:");
  console.log(git(["diff", "--name-status", `${latestAmoTag}..HEAD`]) || "  none");
}

if (manifest.version === publishedVersion && commitsSince && commitsSince !== "0") {
  console.log("");
  console.log(`Warning: local code changed after ${latestAmoTag}, but version is still ${manifest.version}.`);
  console.log("Bump the extension version before preparing the next AMO upload.");
}

if (worktreeStatus) {
  console.log("");
  console.log("Uncommitted local changes:");
  console.log(worktreeStatus);
}
