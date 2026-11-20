'use strict';
// Non-destructive consistency audit. Counts problems without printing patient details.
const {connect}=require('./db');
const {appointmentSlotsOverlap}=require('./rules');
(async()=>{
 let client;const issues=[];
 try {
  const conn=await connect();client=conn.client;const db=conn.db;
  const names=['patients','doctors','appointments','consultations','triage','prescriptions','lab_requests','lab_results','invoices','payments'];
  const docs=Object.fromEntries(await Promise.all(names.map(async n=>[n,await db.collection(n).find({}).toArray()])));
  const keys=Object.fromEntries(names.map(n=>[n,new Set(docs[n].map(r=>r._id))]));
  const ensure=(c,r,field,to)=>{if(!keys[to].has(r[field]))issues.push(`${c} ${r._id}: missing ${to} reference (${field}).`);};
  for(const a of docs.appointments){ensure('appointments',a,'patient_id','patients');ensure('appointments',a,'doctor_id','doctors');}
  const appointmentMap=new Map(docs.appointments.map(x=>[x._id,x]));
  for(const c of ['consultations','triage','prescriptions','lab_requests','invoices'])for(const r of docs[c]){
   ensure(c,r,'appointment_id','appointments');ensure(c,r,'patient_id','patients');
   const a=appointmentMap.get(r.appointment_id);if(!a)continue;
   if(a.patient_id!==r.patient_id)issues.push(`${c} ${r._id}: patient differs from appointment.`);
   if(['consultations','prescriptions','lab_requests'].includes(c)&&r.doctor_id!==a.doctor_id)issues.push(`${c} ${r._id}: doctor differs from appointment.`);
   if(['Cancelled','No-show'].includes(a.status))issues.push(`${c} ${r._id}: linked to a cancelled/missed appointment.`);
  }
  const active=docs.appointments.filter(a=>!['Cancelled','No-show'].includes(a.status));
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
   const a=active[i],b=active[j];if(a.doctor_id===b.doctor_id&&appointmentSlotsOverlap(a.scheduled_at,b.scheduled_at))
    issues.push(`Overlapping doctor appointment slots: ${a._id} and ${b._id}.`);
  }
  const uniqueAppointment=(c)=>{const used=new Set();for(const r of docs[c]){if(used.has(r.appointment_id))issues.push(`${c}: duplicate appointment ${r.appointment_id}.`);used.add(r.appointment_id);}};
  uniqueAppointment('consultations');uniqueAppointment('triage');
  for(const r of docs.lab_results){ensure('lab_results',r,'request_id','lab_requests');ensure('lab_results',r,'patient_id','patients');}
  const resultIds=new Set(docs.lab_results.map(r=>r.request_id));for(const r of docs.lab_requests)if(r.status==='Completed'&&!resultIds.has(r._id))issues.push(`Completed lab request ${r._id} has no lab result.`);
  const sums=new Map();for(const p of docs.payments){ensure('payments',p,'invoice_id','invoices');ensure('payments',p,'patient_id','patients');sums.set(p.invoice_id,(sums.get(p.invoice_id)||0)+p.amount);}
  for(const i of docs.invoices){const paid=sums.get(i._id)||0;const expected=paid===0?'Unpaid':paid>=i.total_amount?'Paid':'Part-paid';
   if(paid!==i.amount_paid||i.status!==expected)issues.push(`Invoice ${i._id}: amount or status does not match payments.`);
  }
  console.log('--- Clinic MongoDB relationship audit (read-only) ---');for(const n of names)console.log(`${n}: ${docs[n].length}`);
  console.log(`Consistency issues: ${issues.length}`);for(const i of issues.slice(0,50))console.log('! '+i);
  if(issues.length>50)console.log(`... ${issues.length-50} more.`);
  if(issues.length)process.exitCode=1;
 }catch(e){console.error('Audit could not complete:',e.message);process.exitCode=1;}finally{if(client)await client.close();}
})();
