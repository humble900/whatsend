import test from 'node:test';
import assert from 'node:assert/strict';
import {foldReactions} from '../src/lib/message-reactions';
test('replacement and removal affect only the reacting person and target message',()=>{
 const row=(id:string,emoji:string,me:boolean,time:number)=>({isFromMe:me,messageType:'reaction',payload:{key:{id},reaction:emoji,actor:'customer'},createdAt:new Date(time)});
 const rows=[row('A','👍',true,1),row('A','❤️',false,2),row('A','😂',true,3),row('B','😮',false,4),row('A','',true,5)];
 assert.deepEqual(foldReactions(rows.reverse(),'A'),[{emoji:'❤️',fromMe:false,actor:'customer'}]);
 assert.deepEqual(foldReactions(rows,'B'),[{emoji:'😮',fromMe:false,actor:'customer'}]);
});
