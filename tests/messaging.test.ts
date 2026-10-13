import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { outboundPayloadSchema, evolutionMessageRequest, phoneSchema, advanceReceipt, isOptOut } from "../src/lib/messaging-contracts";
import { isWithinSendingWindow, nextSendingWindow } from "../src/lib/campaign-policy";
import { eventItems, phoneJid, receiptStatus } from "../src/lib/evolution-events";
import { evolutionRequest } from "../src/lib/evolution-request";

test("direct sends do not request typing, campaign delays, or campaign quotas",()=>{
 const request=evolutionMessageRequest("+234 906-474-5087",{type:"text",text:"Fixture text"});
 assert.equal(request.path,"sendText");assert.equal((request.body as any).delay,0);assert.equal((request.body as any).number,"2349064745087");assert.equal((request.body as any).text,"Fixture text");assert.equal("campaignId" in request.body,false);assert.equal("options" in request.body,false);
});
test("v2 list uses footerText and rejects missing required fields",()=>{
 const payload=outboundPayloadSchema.parse({type:"list",title:"Menu",buttonText:"Open",footerText:"Footer",sections:[{title:"Options",rows:[{title:"Support",rowId:"support"}]}]});
 const request=evolutionMessageRequest("15555550123",payload);assert.equal(request.path,"sendList");assert.equal((request.body as any).footerText,"Footer");assert.equal("footer" in request.body,false);
 assert.equal(outboundPayloadSchema.safeParse({type:"list",title:"Menu"}).success,false);
});
test("current buttons accept typed reply buttons and reject legacy objects",()=>{
 assert.equal(outboundPayloadSchema.safeParse({type:"buttons",title:"Choose",buttons:[{type:"reply",id:"support",displayText:"Support"}]}).success,true);
 assert.equal(outboundPayloadSchema.safeParse({type:"buttons",title:"Choose",buttons:[{type:1,buttonId:"support",buttonText:{displayText:"Support"}}]}).success,false);
});
test("media strips data URI before sending; private media URLs are rejected",()=>{
 const payload=outboundPayloadSchema.parse({type:"media",mediatype:"image",media:"data:image/png;base64,aGVsbG8="});assert.equal((payload as any).media,"aGVsbG8=");
 assert.equal(outboundPayloadSchema.safeParse({type:"media",mediatype:"image",media:"https://127.0.0.1/private"}).success,false);
 assert.equal(outboundPayloadSchema.safeParse({type:"media",mediatype:"image",media:"https://redis.railway.internal/private"}).success,false);
});
test("poll choices and E164 normalization are validated",()=>{
 assert.equal(outboundPayloadSchema.safeParse({type:"poll",name:"Choose",values:["One","Two"],selectableCount:3}).success,false);
 assert.equal(phoneSchema.parse("15555550123@s.whatsapp.net"),"15555550123");assert.throws(()=>phoneSchema.parse("15555550123@lid"));
});
test("single/batch webhook messages and receipt formats normalize",()=>{
 const msg={key:{id:"test-id",remoteJid:"15555550123@s.whatsapp.net"}};
 assert.deepEqual(eventItems(msg),[msg]);assert.deepEqual(eventItems({messages:[msg]}),[msg]);assert.equal(phoneJid({remoteJid:"123@lid",remoteJidAlt:msg.key.remoteJid}),msg.key.remoteJid);assert.equal(phoneJid({remoteJid:"123@g.us"}),null);assert.equal(receiptStatus({status:"READ"}),"read");assert.equal(receiptStatus({update:{status:3}}),"delivered");
});
test("out-of-order receipts never regress delivered or read",()=>{
 assert.equal(advanceReceipt("sent","failed"),"failed");
 assert.equal(advanceReceipt("delivered","failed"),"delivered");
 assert.equal(advanceReceipt("read","sent"),"read");assert.equal(advanceReceipt("delivered","failed"),"delivered");assert.equal(advanceReceipt("uncertain","delivered"),"delivered");assert.equal(advanceReceipt("sent","read"),"read");
});
test("opt-out is honored without mistaking ordinary conversation for STOP",()=>{
 assert.equal(isOptOut("STOP"),true);assert.equal(isOptOut("unsubscribe please"),true);assert.equal(isOptOut("Please stop by tomorrow"),false);
});
test("sending windows respect campaign timezone and overnight boundaries",()=>{
 const windows=[{start:"09:00",end:"17:00"}];assert.equal(isWithinSendingWindow(windows,"Africa/Lagos",new Date("2026-10-12T08:00:00Z")),true);assert.equal(isWithinSendingWindow(windows,"Africa/Lagos",new Date("2026-10-12T16:00:00Z")),false);assert.equal(isWithinSendingWindow([{start:"22:00",end:"06:00"}],"UTC",new Date("2026-10-12T02:00:00Z")),true);assert.equal(nextSendingWindow(windows,"UTC",new Date("2026-10-12T08:59:00Z")),new Date("2026-10-12T09:00:00Z").getTime());
});
test("HTTP adapter sends the exact payload and preserves provider status",async()=>{
 const server=createServer(async(req,res)=>{let body="";for await(const chunk of req)body+=chunk;assert.equal(JSON.parse(body).text,"Transport fixture");res.writeHead(201,{"Content-Type":"application/json"});res.end(JSON.stringify({key:{id:"transport-fixture"}}));});
 await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
 try {const port=(server.address() as any).port;const response=await evolutionRequest(`http://127.0.0.1:${port}/message/sendText/fixture`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:"Transport fixture"})});assert.equal(response.status,201);assert.equal((await response.json()).key.id,"transport-fixture");}finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
test("transport deadline aborts an unresponsive request",async()=>{
 const server=createServer((_req,_res)=>{});await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
 try {const port=(server.address() as any).port;await assert.rejects(evolutionRequest(`http://127.0.0.1:${port}/fixture`,{method:"GET"},25));}finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
