#!/usr/bin/env node
/**
 * Quick, conservative tracked-file secret gate; not a substitute for GitHub
 * secret scanning or historical Git scanning. Never print matched values.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const patterns = [
  ["private-key-block", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ["github-personal-access-token", /(?:ghp_|github_pat_)[A-Za-z0-9_]{25,}/],
  ["openai-project-key", /sk-proj-[A-Za-z0-9_-]{20,}/],
  ["openrouter-key", /sk-or-v1-[A-Za-z0-9]{20,}/],
  ["google-api-key", /AIza[0-9A-Za-z_-]{35}/],
];
function candidate(path) {
  return !/(?:^|\/)(?:node_modules|\.next|out|build|dist|coverage|test-results)\//.test(path) &&
    !/package-lock\.json$|\.svg$|\.png$|\.jpg$|\.webp$|\.gif$|\.ico$/.test(path);
}
export function scanTrackedFiles(paths, load) {
  const issues = [];
  for (const path of paths.filter(candidate)) {
    let value;
    try { value = load(path); } catch { continue; }
    for (const [type, pattern] of patterns) {
      if (pattern.test(value)) issues.push({ path, type });
    }
  }
  return issues;
}
if (process.argv[1]?.endsWith("security-static-check.mjs")) {
  const paths = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0").filter(Boolean);
  const findings = scanTrackedFiles(paths, path => readFileSync(path, "utf8"));
  for (const { path, type } of findings) console.error("Potential secret:", type, "in", path);
  if (findings.length) process.exitCode = 1;
  else console.log("Tracked-file secret heuristics: no matches (history/runtime not scanned)");
}
