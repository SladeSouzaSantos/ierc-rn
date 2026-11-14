import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('worker image normalizes only application source permissions before USER node',()=>{
  const dockerfile=readFileSync(new URL('../Dockerfile',import.meta.url),'utf8');
  const copy=dockerfile.indexOf('COPY src ./src');
  const normalize=dockerfile.indexOf('RUN chmod -R a+rX /app/src');
  const drop=dockerfile.indexOf('USER node');
  assert.ok(copy>=0,'source code must be copied to /app/src');
  assert.ok(normalize>copy,'chmod source must happen after COPY');
  assert.ok(drop>normalize,'nonroot user must be set after source is readable');
  assert.doesNotMatch(dockerfile,/chmod\s+-R\s+[^\n]*(?:\/app\s*$|\.env|\/secrets)/m,
    'never relax permissions on environment secrets');
  assert.doesNotMatch(dockerfile,/COPY\s+\S*\.env/,'environment keys must not be baked');
});
