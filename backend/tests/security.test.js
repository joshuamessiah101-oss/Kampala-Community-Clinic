'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {app}=require('../server');

test('local dashboard opens without a session and blocks cross-site writes',async()=>{
 const server=app.listen(0,'127.0.0.1');
 await once(server,'listening');
 try {
  const url=`http://127.0.0.1:${server.address().port}`;
  for(const route of ['/','/dashboard']){
   const page=await fetch(url+route);
   assert.equal(page.status,200);
   assert.match(await page.text(),/id="workspace"/);
  }
  const workspace=await fetch(url+'/api/workspace');
  const data=await workspace.json();
  assert.equal(workspace.status,200);
  assert.equal(data.permissions.patients.create,true);
  assert.equal(data.permissions.audit_logs.edit,false);
  assert.equal(data.permissions.users,undefined);
  const write=await fetch(url+'/api/patients',{method:'POST',headers:{Origin:'https://example.com'}});
  assert.equal(write.status,403);
 } finally {
  await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
 }
});
