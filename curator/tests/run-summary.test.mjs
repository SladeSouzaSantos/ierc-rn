import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeRunForLog } from '../src/run-summary.mjs';

test('successful run with no eligible articles is not a publication', () => {
  assert.deepEqual(summarizeRunForLog({results:[],count:0}), {
    published:0,draftsCreated:0,statusCounts:{},
  });
});

test('LLM outage and review hold are not counted as published', () => {
  assert.deepEqual(summarizeRunForLog({results:[
    {status:'llm_unavailable',source:'agencia-brasil-educacao'},
    {status:'draft_created_review_pending',source:'agencia-brasil-esportes'},
  ]}),{
    published:0,draftsCreated:1,
    statusCounts:{llm_unavailable:1,draft_created_review_pending:1},
  });
});

test('published counts only CMS-confirmed publication, excluding failed writes', () => {
  assert.deepEqual(summarizeRunForLog({results:[
    {status:'draft_published',title:'Do not log private content'},
    {status:'draft_created_publish_failed',token:'PRIVATE'},
  ]}),{
    published:1,draftsCreated:2,
    statusCounts:{draft_published:1,draft_created_publish_failed:1},
  });
});

test('untrusted status text is not inserted into logs', () => {
  assert.deepEqual(summarizeRunForLog({results:[
    {status:'__proto__'}, {status:'password=secret'},
    {status:null}, {status:'seen'},
  ]}),{
    published:0,draftsCreated:0,statusCounts:{seen:1},
  });
});
