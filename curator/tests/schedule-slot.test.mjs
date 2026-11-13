import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CURATOR_SCHEDULE_HOURS,CURATOR_SCHEDULE_TIMEZONE,
  CURATOR_SCHEDULE_LEASE_SECONDS,currentCuratorSlot,
  createCuratorSlotClaimer} from '../src/schedule-slot.mjs';

const clock=iso=>()=>new Date(iso);

test('existing America/Fortaleza schedule stays 08h, 13h, 19h',()=>{
  assert.equal(CURATOR_SCHEDULE_TIMEZONE,'America/Fortaleza');
  assert.deepEqual(CURATOR_SCHEDULE_HOURS,['08','13','19']);
  assert.equal(CURATOR_SCHEDULE_LEASE_SECONDS,172800);
  for(const [utc,hour] of [
    ['2026-11-13T11:00:00.000Z','08'],
    ['2026-11-13T16:00:00.000Z','13'],
    ['2026-11-13T22:00:00.000Z','19'],
  ]){
    assert.equal(currentCuratorSlot(new Date(utc)).id,'2026-11-13:'+hour);
  }
  assert.throws(()=>currentCuratorSlot(new Date('invalid')),/valid date/);
});

test('outside slot window uses no Redis commands and does not log',async()=>{
  const calls=[],logs=[];
  for(const when of ['2026-11-13T15:59:59.000Z',
    '2026-11-13T16:03:00.000Z','2026-11-13T18:55:00.000Z']){
    const claim=createCuratorSlotClaimer({
      redis:{set:async(...args)=>calls.push(args)},
      now:clock(when),logger:x=>logs.push(x),
    });
    assert.equal((await claim()).state,'outside_window');
  }
  assert.equal(calls.length,0);
  assert.deepEqual(logs,[]);
});

test('claimed slot keeps exact NX Redis lease, emits one safe claim event',async()=>{
  const calls=[],logs=[];
  const claim=createCuratorSlotClaimer({
    redis:{set:async(...args)=>{calls.push(args);return 'OK';}},
    now:clock('2026-11-13T16:00:30.000Z'),logger:x=>logs.push(x),
  });
  assert.deepEqual(await claim(),{state:'claimed',slot:'2026-11-13:13'});
  assert.deepEqual(calls,[['ierc:curator:job:2026-11-13:13','1','EX',172800,'NX']]);
  assert.deepEqual(logs,[{event:'schedule_slot_claimed',slot:'2026-11-13:13'}]);
});

test('an earlier worker claim is visible but never duplicated/retried',async()=>{
  const logs=[],keys=[];let time='2026-11-13T16:00:10.000Z';
  const claim=createCuratorSlotClaimer({
    redis:{set:async(...args)=>{keys.push(args);return null;}},
    now:()=>new Date(time),logger:x=>logs.push(x),
  });
  assert.deepEqual(await claim(),{state:'already_claimed',slot:'2026-11-13:13'});
  time='2026-11-13T16:00:40.000Z';
  assert.equal((await claim()).state,'already_claimed');
  assert.equal(keys.length,2); // polling remains every 30 seconds
  assert.deepEqual(logs,[{
    event:'schedule_slot_skipped',slot:'2026-11-13:13',reason:'already_claimed',
  }]);
});

test('a worker that claims its own slot does not emit a false duplicate warning',async()=>{
  const events=[];let n=0;
  const claim=createCuratorSlotClaimer({
    redis:{set:async()=>++n===1?'OK':null},
    now:clock('2026-11-13T16:00:01.000Z'),
    logger:x=>events.push(x),
  });
  assert.equal((await claim()).state,'claimed');
  assert.equal((await claim()).state,'already_claimed');
  assert.deepEqual(events,[{event:'schedule_slot_claimed',slot:'2026-11-13:13'}]);
});

test('Redis errors still fail closed and unexpected lease answers are rejected',async()=>{
  const logs=[];
  const bad=createCuratorSlotClaimer({
    redis:{set:async()=>false},now:clock('2026-11-13T16:00:00.000Z'),
    logger:x=>logs.push(x),
  });
  await assert.rejects(bad(),/Unexpected Redis scheduler lease response/);
  assert.deepEqual(logs,[]);
  const offline=createCuratorSlotClaimer({
    redis:{set:async()=>{throw Error('redis down')}},
    now:clock('2026-11-13T16:00:00.000Z'),logger:x=>logs.push(x),
  });
  await assert.rejects(offline(),/redis down/);
  assert.deepEqual(logs,[]);
});
