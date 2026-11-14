import { test } from "node:test";
import assert from "node:assert/strict";
import { scanTrackedFiles } from "../security-static-check.mjs";

test("secret heuristic reports path and class without copying secret values", () => {
  const fake = ["-----BEGIN ", "PRIVATE KEY-----"].join("");
  const findings=scanTrackedFiles(["src/config.txt"],()=>fake);
  assert.deepEqual(findings,[{path:"src/config.txt",type:"private-key-block"}]);
  assert.equal(JSON.stringify(findings).includes(fake),false);
});
test("secret heuristic excludes assets and rejects no normal source", () => {
  const issues=scanTrackedFiles(["public/logo.svg","src/main.ts"],path=>
    path.endsWith(".ts")?"export const title = 'IERC-RN'":"non-source");
  assert.deepEqual(issues,[]);
});
