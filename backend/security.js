'use strict';
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
module.exports={enforceOrigin,headers};
