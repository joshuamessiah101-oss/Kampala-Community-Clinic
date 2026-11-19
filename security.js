'use strict';
const crypto=require('crypto');
const {HttpError}=require('./rules');
const COOKIE='clinic_session';
function hashPassword(password,salt=crypto.randomBytes(16).toString('hex')) {
 if(typeof password!=='string'||password.length<12||password.length>128) throw new HttpError(400,'Password must have 12 to 128 characters.');
 const derived=crypto.scryptSync(password,salt,64).toString('hex'); return `scrypt:${salt}:${derived}`;
}
function verifyPassword(password,stored) {
 if(typeof stored!=='string'||!stored.startsWith('scrypt:')) return false;
 const [scheme,salt,hex]=stored.split(':');
 if(scheme!=='scrypt'||!salt||!hex||!(/^[a-f\d]{128}$/.test(hex))) return false;
 try { const actual=crypto.scryptSync(password,salt,64); return crypto.timingSafeEqual(actual,Buffer.from(hex,'hex')); } catch {return false;}
}
function hashToken(t) {return crypto.createHash('sha256').update(t).digest('hex');}
function randomToken() {return crypto.randomBytes(32).toString('hex');}
function readCookie(req,name=COOKIE) { const raw=req.headers.cookie||''; const item=raw.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'=')); return item?item.slice(name.length+1):null; }
function sessionCookie(token, req, clear=false) {const secure=process.env.COOKIE_SECURE==='true'||req.secure; return `${COOKIE}=${clear?'':token}; Path=/; HttpOnly; SameSite=Strict; ${secure?'Secure; ':''}Max-Age=${clear?0:12*3600}`;}
function enforceOrigin(req,res,next) {
 if(['POST','PUT','PATCH','DELETE'].includes(req.method)) {
  const origin=req.headers.origin;
  if(origin) {let parsed; try {parsed=new URL(origin);}catch{return res.status(403).json({error:'Invalid request origin.'});}
   if(parsed.host!==req.headers.host || !['http:','https:'].includes(parsed.protocol)) return res.status(403).json({error:'Cross-site request blocked.'});
  }
 }
 next();
}
function headers(req,res,next) {
 res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('X-Frame-Options','DENY'); res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 res.setHeader('Cache-Control',req.path.startsWith('/api/')?'no-store':'no-cache'); next();
}
module.exports={hashPassword,verifyPassword,hashToken,randomToken,readCookie,sessionCookie,enforceOrigin,headers,COOKIE};
