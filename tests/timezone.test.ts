import test from 'node:test';
import assert from 'node:assert/strict';
import {isWithinSendingWindow,nextSendingWindow} from '../src/lib/campaign-policy';
test('campaign hours follow the chosen zone, not server time',()=>{
 const windows=[{start:'09:00',end:'17:00'}],now=new Date('2026-10-13T08:00:00Z');
 assert.equal(isWithinSendingWindow(windows,'Africa/Lagos',now),true);
 assert.equal(isWithinSendingWindow(windows,'America/New_York',now),false);
 assert.equal(new Date(nextSendingWindow(windows,'America/New_York',now)).toISOString(),'2026-10-13T13:00:00.000Z');
});
test('daylight saving and overnight windows use local clock time',()=>{
 const windows=[{start:'09:00',end:'17:00'}];
 assert.equal(isWithinSendingWindow(windows,'America/New_York',new Date('2026-03-07T13:30:00Z')),false);
 assert.equal(isWithinSendingWindow(windows,'America/New_York',new Date('2026-03-08T13:30:00Z')),true);
 assert.equal(isWithinSendingWindow([{start:'22:00',end:'02:00'}],'Africa/Lagos',new Date('2026-10-13T23:30:00Z')),true);
 assert.equal(isWithinSendingWindow(windows,'Africa/Lagos',new Date('2026-10-13T16:00:00Z')),false);
});
test('next window survives the 25-hour daylight saving day',()=>{
 const windows=[{start:'00:30',end:'00:31'}];
 const next=new Date(nextSendingWindow(windows,'America/New_York',new Date('2026-11-01T04:31:00Z')));
 assert.equal(next.toISOString(),'2026-11-02T05:30:00.000Z');
});
