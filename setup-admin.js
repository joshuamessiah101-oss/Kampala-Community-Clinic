'use strict';
const {connect,setupSchema}=require('./db');
const {hashPassword}=require('./security');
const readline=require('readline');
const crypto=require('crypto');
async function ask(prompt){const rl=readline.createInterface({input:process.stdin,output:process.stdout});const answer=await new Promise(resolve=>rl.question(prompt,resolve));rl.close();return answer.trim();}
async function secret(prompt){
 if(process.env.CLINIC_ADMIN_PASSWORD) return process.env.CLINIC_ADMIN_PASSWORD;
 if(!process.stdin.isTTY) throw Error('An interactive terminal is required. Set CLINIC_ADMIN_PASSWORD if using automated setup.');
 process.stdout.write(prompt);process.stdin.resume();process.stdin.setRawMode(true);process.stdin.setEncoding('utf8');
 return await new Promise((resolve,reject)=>{
  let password='';const onData=chunk=>{
   for(const ch of chunk){if(ch==='\r'||ch==='\n'){process.stdin.removeListener('data',onData);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');resolve(password);return;}
    if(ch==='\u0003'){process.stdin.removeListener('data',onData);process.stdin.setRawMode(false);process.stdin.pause();reject(Error('Setup cancelled.'));return;}
    if(ch==='\u007f'||ch==='\b'){password=password.slice(0,-1);continue;}
    if(ch.charCodeAt(0)>=32)password+=ch;
   }
  };process.stdin.on('data',onData);
 });
}
(async()=>{
 let client;
 try{
  const connection=await connect();client=connection.client;const db=connection.db;await setupSchema(db);
  if(await db.collection('users').countDocuments({role:'admin'}))throw Error('An administrator already exists. For security, setup cannot reset the admin password.');
  const username=(process.env.CLINIC_ADMIN_USERNAME||await ask('Choose an administrator username: ')).trim().toLowerCase();
  if(!/^[a-z0-9._-]{3,60}$/.test(username))throw Error('Username must contain 3–60 letters, numbers, dots, underscores or dashes.');
  const password=await secret('Choose a strong password (12+ characters, hidden): ');
  const hashed=hashPassword(password);
  await db.collection('users').insertOne({_id:'U001',username,password_hash:hashed,role:'admin',active:true});
  console.log(`Administrator created: ${username}. Your password was not saved in plaintext.`);
 }catch(e){console.error('Admin setup failed:',e.message);process.exitCode=1;}finally{if(client)await client.close();}
})();
