import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scheduleDraftLimitFromEnv} from '../src/schedule-config.mjs';

test('DEV scheduled curator defaults to exactly one draft per 08/13/19 slot',()=>{
  assert.equal(scheduleDraftLimitFromEnv({}),1);
  assert.equal(scheduleDraftLimitFromEnv({CURATOR_SCHEDULE_LIMIT:'1'}),1);
});

test('scheduled draft throughput cannot be raised or disabled via env',()=>{
  for (const v of ['0','2','3','1.0','01','-1','NaN','','unlimited']){
    assert.throws(()=>scheduleDraftLimitFromEnv({CURATOR_SCHEDULE_LIMIT:v}),
      /CURATOR_SCHEDULE_LIMIT must be 1/);
  }
});
