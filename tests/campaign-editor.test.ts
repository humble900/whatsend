import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeImportPhone} from '../src/lib/phone-normalization';
import {leadVariables,missingVariables,templateVariables,contactVariables} from '../src/lib/campaign-personalization';
import {injectVariables,parseSpintax} from '../src/lib/spintax';
import {campaignEditSchema} from '../src/lib/campaign-service';
test('default country converts local numbers and never doubles international prefixes',()=>{
 assert.equal(normalizeImportPhone('09025664243','234',true),'2349025664243');
 assert.equal(normalizeImportPhone('+2349025664243','234',true),'2349025664243');
 assert.equal(normalizeImportPhone('2349025664243','234',true),'2349025664243');
 assert.equal(normalizeImportPhone('+44 7911 123456','234',true),'447911123456');
 assert.equal(normalizeImportPhone('0044 7911 123456','234',true),'447911123456');
 assert.equal(normalizeImportPhone('(213) 373-4253','1',true),'12133734253');
 assert.equal(normalizeImportPhone('07911 123456','44',true),'447911123456');
 assert.equal(normalizeImportPhone('02 36618 300','39',true),'390236618300');
});
test('country toggle off requires a complete number; empty or invalid defaults cannot pass through',()=>{
 assert.equal(normalizeImportPhone('2349025664243','',false),'2349025664243');
 assert.equal(normalizeImportPhone('09025664243','',false),null);
 assert.equal(normalizeImportPhone('09025664243','',true),null);
 assert.equal(normalizeImportPhone('09025664243','999',true),null);
 assert.equal(normalizeImportPhone('garbage1234567','234',true),null);
});
test('personalization resolves built-ins and imported columns and preserves unknown tokens',()=>{
 const values=leadVariables({name:'Ada Lovelace',phone:'447911123456',variables:{company:'Analytical',first_name:'Ada',phone:'bad'}});
 assert.equal(values.phone,'447911123456');assert.equal(values.last_name,'Lovelace');
 assert.equal(injectVariables('Hi {{first_name}}, at {{company}}',values),'Hi Ada, at Analytical');
 assert.equal(injectVariables('Hi {name}',values),'Hi Ada Lovelace');
 assert.deepEqual(missingVariables('Hi {name}',{name:''}),['name']);
 assert.deepEqual(missingVariables('Hi {{missing}} {{missing}}',values),['missing']);
 assert.equal(parseSpintax('Hi {{missing}}, {Hello|Hey}!').includes('{{missing}}'),true);
 assert.deepEqual(templateVariables('{{name}} {{company}} {{name}}'),['name','company']);
 assert.equal(injectVariables('{{company}}',{company:''}),'');
});
test('draft variants retain disabled state and permit empty text drafts',()=>{
 const result=campaignEditSchema.parse({variants:[{id:'A',label:'Variant A',weight:50,enabled:false,spintaxTemplate:'',payload:{type:'text',text:''}}]});assert.equal(result.variants?.[0].enabled,false);
});
test('CRM columns retain primitive values without exposing server metadata as variables',()=>{
 assert.deepEqual(contactVariables({company:'Analytical', ' price ':42,member:true,_waStatus:'verified',nested:{a:1}}),{company:'Analytical',price:'42',member:'true'});
});
