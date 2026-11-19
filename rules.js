'use strict';
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const bad = m => new HttpError(400,m);
const conflict = m => new HttpError(409,m);
function text(v,label,max=150) { if(typeof v!=='string'||!v.trim()) throw bad(`${label} is required.`); const s=v.trim(); if(s.length>max) throw bad(`${label} must be at most ${max} characters.`); return s; }
function optionalText(v,label,max=150) { if(v===undefined || v===null || v==='') return ''; return text(v,label,max); }
function choice(v,label,options) { if(!options.includes(v)) throw bad(`${label} must be one of: ${options.join(', ')}.`); return v; }
function num(v,label,min,max,{integer=false,optional=false}={}) { if((v===undefined||v===null||v==='')&&optional) return null; if(v===undefined||v===null||v==='') throw bad(`${label} is required.`); const x=Number(v); if(!Number.isFinite(x)||x<min||x>max||(integer&&!Number.isInteger(x))) throw bad(`${label} must be ${integer?'a whole number':'a number'} from ${min} to ${max}.`); return x; }
function date(v,label) { if(typeof v!=='string' || !v || !Number.isFinite(Date.parse(v))) throw bad(`${label} must be a valid date/time.`); return new Date(v); }
function symptoms(v) { let a=typeof v==='string'?v.split(','):v; if(!Array.isArray(a)) throw bad('Symptoms must be a list.'); a=a.map(s=>text(s,'Symptom',100)); if(a.length<1||a.length>20) throw bad('Provide 1 to 20 symptoms.'); return a; }
function phone(v) { const s=optionalText(v,'Phone',22); if(s && !/^\+?[\d()\s-]{9,22}$/.test(s)) throw bad('Phone number is invalid.'); return s; }
function appointmentSlotsOverlap(a,b,minutes=30) {const x=+new Date(a),y=+new Date(b);if(!Number.isFinite(x)||!Number.isFinite(y))return false;return Math.abs(x-y)<minutes*60000;}
function appointmentStatusTransition(oldStatus,newStatus) {
  const next={Scheduled:['Scheduled','Checked-in','Cancelled','No-show'], 'Checked-in':['Checked-in','In-progress','Cancelled','No-show'], 'In-progress':['In-progress','Completed'],Completed:['Completed'],Cancelled:['Cancelled'],'No-show':['No-show']};
  return !!(next[oldStatus]||[]).includes(newStatus);
}
const ROLES=['admin','reception','nurse','clinician','lab','pharmacy','cashier'];
const ALL=ROLES;
const ACCESS={
 patients:{read:ALL,write:['admin','reception'],delete:['admin']},
 doctors:{read:ALL,write:['admin'],delete:['admin']},
 appointments:{read:ALL,write:['admin','reception','nurse','clinician'],delete:['admin']},
 consultations:{read:['admin','nurse','clinician'],write:['clinician'],delete:['admin']},
 triage:{read:['admin','nurse','clinician'],write:['nurse','clinician'],delete:['admin']},
 prescriptions:{read:['admin','clinician','pharmacy'],write:['clinician'],delete:[]},
 lab_requests:{read:['admin','clinician','lab'],write:['clinician','lab'],delete:[]},
 lab_results:{read:['admin','clinician','lab'],write:['lab'],delete:[]},
 invoices:{read:['admin','reception','cashier'],write:['admin','cashier'],delete:['admin']},
 payments:{read:['admin','cashier'],write:['admin','cashier'],delete:[]},
 users:{read:['admin'],write:['admin'],delete:[]},
 audit_logs:{read:['admin'],write:[],delete:[]}
};
function can(role,collection,action) { return !!ACCESS[collection]?.[action]?.includes(role); }
module.exports={HttpError,bad,conflict,text,optionalText,choice,num,date,symptoms,phone,appointmentStatusTransition,appointmentSlotsOverlap,ROLES,ACCESS,can};
