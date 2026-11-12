import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {connectQuotaRedis,closeQuotaRedis} from '../src/redis-connection.mjs';

function fake({failConnect=false,failPing=false,failQuit=false,statusAtClose='ready'}={}){
  const events=[];
  class Client extends EventEmitter {
    constructor(address,options){
      super();
      assert.equal(address,'redis://redis:6379');
      assert.equal(options.lazyConnect,true);
      assert.equal(options.enableOfflineQueue,false);
      assert.equal(options.maxRetriesPerRequest,1);
      events.push('constructor');
      this.status='wait';
    }
    async connect(){
      events.push('connect');
      if(failConnect)throw new Error('SECRET_REDIS_PASSWORD could not connect');
      this.status='ready';
    }
    async ping(){
      events.push('ping');
      assert.equal(this.status,'ready','No PING before readiness');
      if(failPing)throw new Error('Redis not responding');
      return 'PONG';
    }
    async quit(){
      events.push('quit');
      assert.equal(this.status,'ready');
      if(failQuit)throw new Error('Stream is not writeable');
      this.status='end';
    }
    disconnect(){
      events.push('disconnect');
      this.status='end';
    }
  }
  return {createClient:(url,options)=>new Client(url,options),events};
}

test('explicit connection precedes PING with offline queue disabled, then clean QUIT',async()=>{
  const {events,createClient}=fake();
  const redis=await connectQuotaRedis('redis://redis:6379',createClient);
  assert.equal(redis.status,'ready');
  assert.deepEqual(events,['constructor','connect','ping']);
  await closeQuotaRedis(redis);
  assert.deepEqual(events,['constructor','connect','ping','quit']);
});

test('failed Redis connection rejects without PING, model call or credentials in error',async()=>{
  const {events,createClient}=fake({failConnect:true});
  let message='';
  await assert.rejects(connectQuotaRedis('redis://redis:6379',createClient),e=>{
    message=e.message;
    return /quota enforcement blocked/.test(message);
  });
  assert.ok(!message.includes('SECRET_REDIS_PASSWORD'));
  assert.deepEqual(events,['constructor','connect','disconnect']);
});

test('PING failure disconnects instead of leaving a quota-bypassing client',async()=>{
  const {events,createClient}=fake({failPing:true});
  await assert.rejects(connectQuotaRedis('redis://redis:6379',createClient),/quota enforcement blocked/);
  assert.deepEqual(events,['constructor','connect','ping','disconnect']);
});

test('QUIt failure does not replace a successful or failed worker result',async()=>{
  const {events,createClient}=fake({failQuit:true});
  const redis=await connectQuotaRedis('redis://redis:6379',createClient);
  await assert.doesNotReject(closeQuotaRedis(redis));
  assert.deepEqual(events,['constructor','connect','ping','quit','disconnect']);
});

test('closing Redis before readiness never sends QUIT',async()=>{
  const {events,createClient}=fake();
  const redis=createClient('redis://redis:6379',{lazyConnect:true,enableOfflineQueue:false,maxRetriesPerRequest:1});
  redis.status='connecting';
  await closeQuotaRedis(redis);
  assert.deepEqual(events,['constructor','disconnect']);
  await closeQuotaRedis(null);
});
