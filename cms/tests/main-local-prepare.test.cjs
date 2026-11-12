const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

const root = join(__dirname, "../..");
const read = (path) => readFileSync(join(root, path), "utf8");

test("MAIN preparation only acts in main, keeps DEV data and requires explicit local start", () => {
  const script = read("scripts/prepare-main-minimac.sh");
  assert.match(script, /\$\(git branch --show-current\).*main/);
  assert.match(script, /--prepare\|--check\|--start-local/);
  assert.match(script, /node cms\/scripts\/init-env\.mjs --prod/);
  assert.match(script, /-v "\$PWD:\/workspace"/);
  assert.match(script, /\[\[ ! -e cms\/\.env\.prod \]\]/);
  assert.match(script, /\[\[ ! -e deploy\/\.env\.portal\.prod \]\]/);
  assert.match(script, /CMS_ENABLED=false/);
  assert.match(script, /--env-file cms\/\.env\.prod -f compose\.cms\.prod\.yml/);
  assert.match(script, /--env-file deploy\/\.env\.portal\.prod -f compose\.portal\.prod\.yml/);
  assert.match(script, /PREFLIGHT_MAIN_LOCAL_OK/);
  assert.match(script, /--wait/);
  assert.match(script, /\[\[ "\$mode" == --start-local \]\]/);
  assert.doesNotMatch(script, /docker (?:volume|system) prune|compose down|down -v|curator\.dev\.yml/);
});

test("MAIN preparation CLI has safe help and rejects unknown flags without docker access", () => {
  const script = join(root, "scripts/prepare-main-minimac.sh");
  const help = spawnSync("bash", [script, "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /--prepare/);
  assert.match(help.stdout, /--start-local/);
  const invalid = spawnSync("bash", [script, "--bad"], { encoding: "utf8" });
  assert.equal(invalid.status, 2);
});

test("MAIN CMS and portal stay loopback-only with own read network and no worker", () => {
  const cms = read("compose.cms.prod.yml");
  const portal = read("compose.portal.prod.yml");
  assert.match(cms, /^name: ierc-rn-cms-prod$/m);
  assert.match(portal, /^name: ierc-rn-portal-prod$/m);
  assert.match(cms, /127\.0\.0\.1:1338:1337/);
  assert.match(cms, /CMS_INSTANCE_KIND: prod/);
  assert.match(cms, /CMS_DIAGNOSTIC_UNSAFE_EVAL: "false"/);
  assert.match(portal, /127\.0\.0\.1:3102:3000/);
  assert.match(cms + portal, /name: ierc-rn-prod-cms-read/);
  assert.doesNotMatch(cms + portal, /CURATOR_ENABLED|CURATOR_AUTO_PUBLISH_ENABLED|CURATOR_WRITE_DRAFTS/);
  assert.match(read("deploy/portal-prod.env.example"), /CMS_ENABLED=false/);
});
