const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "../..");
const read = (file) => readFileSync(join(root, file), "utf8");

test("separate Compose project names, databases, upload volumes and ports", () => {
  const dev = read("compose.cms.yml");
  const prod = read("compose.cms.prod.yml");
  assert.match(dev, /^name: ierc-rn-cms$/m);
  assert.match(prod, /^name: ierc-rn-cms-prod$/m);
  assert.match(dev, /env_file: \.\/cms\/\.env\s*$/m);
  assert.match(prod, /env_file: \.\/cms\/\.env\.prod\s*$/m);
  assert.match(dev, /"127\.0\.0\.1:1337:1337"/);
  assert.match(prod, /"127\.0\.0\.1:1338:1337"/);
  assert.match(dev, /ierc_cms_pg: \{\}/);
  assert.match(prod, /ierc_cms_pg_prod: \{\}/);
  assert.match(dev, /ierc_cms_uploads: \{\}/);
  assert.match(prod, /ierc_cms_uploads_prod: \{\}/);
  assert.doesNotMatch(prod, /\bcontainer_name:/);
});
test("PROD requires explicitly created, independent secrets and never overwrites DEV", () => {
  const initializer = read("cms/scripts/init-env.mjs");
  assert.match(initializer, /args\[0\] === '--prod'/);
  assert.match(initializer, /isProd \? '\.env\.prod' : '\.env'/);
  assert.match(initializer, /isProd \? 'ierc_cms_prod' : 'ierc_cms'/);
  assert.match(initializer, /if \(existsSync\(path\)\)/);
  assert.match(initializer, /flag: 'wx'/);
  assert.match(initializer, /ENCRYPTION_KEY: secret\(\)/);
  const ignore = read(".gitignore");
  assert.match(ignore, /^\.env\*/m);
});
