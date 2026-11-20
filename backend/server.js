'use strict';
// Kampala Community Clinic: REST API for the local coursework demo.
const express=require('express');
const path=require('path');
const {connect,setupSchema,DB_NAME}=require('./db');
const {HttpError,bad,conflict,text,optionalText,choice,num,date,symptoms,phone,appointmentStatusTransition,appointmentSlotsOverlap,ACCESS}=require('./rules');
const {enforceOrigin,headers}=require('./security');
const app=express();
const PORT=Number(process.env.PORT||3000);
app.disable('x-powered-by');
app.use(headers);
app.use(express.json({limit:'64kb'}));
app.use(enforceOrigin);
app.use((req,res,next)=>{
 const localHosts=[`localhost:${req.socket.localPort}`,`127.0.0.1:${req.socket.localPort}`];
 if (process.env.RENDER_EXTERNAL_HOSTNAME) localHosts.push(process.env.RENDER_EXTERNAL_HOSTNAME);
 if(!localHosts.includes(req.get('host')))return res.status(403).json({error:'Open the clinic from localhost.'});
 next();
});
const frontend=path.join(__dirname,'..','frontend');
app.use(express.static(frontend));
app.get('/dashboard',(req,res)=>res.sendFile(path.join(frontend,'index.html')));
let db;
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const notFound=s=>new HttpError(404,s||'Record not found.');
const FIELDS={
 patients:{prefix:'P',search:['_id','full_name','address.area','address.district','phone']},
 doctors:{prefix:'D',search:['_id','full_name','specialty','department']},
 appointments:{prefix:'A',search:['_id','patient_id','doctor_id','status']},
 consultations:{prefix:'C',search:['_id','appointment_id','patient_id','doctor_id','assessment','diagnosis']},
 triage:{prefix:'T',search:['_id','appointment_id','patient_id']},
 prescriptions:{prefix:'RX',search:['_id','patient_id','appointment_id','medicine','status']},
 lab_requests:{prefix:'LR',search:['_id','patient_id','appointment_id','test_name','status']},
 lab_results:{prefix:'LS',search:['_id','request_id','patient_id','result']},
 invoices:{prefix:'I',search:['_id','patient_id','appointment_id','status']},
 payments:{prefix:'PM',search:['_id','patient_id','invoice_id','method','reference']},
 audit_logs:{prefix:'',search:['actor','action','collection','record_id']}
};
const stat=['Scheduled','Checked-in','In-progress','Completed','Cancelled','No-show'];
async function one(col,id,label=col){if(typeof id!=='string'||!id.trim())throw bad(`${label} is required.`); const x=await db.collection(col).findOne({_id:id});if(!x)throw bad(`${label} ${id} does not exist.`);return x;}
function money(v,label){return num(v,label,0,1000000000,{integer:true});}
function optionalNumber(v,label,min,max){return num(v,label,min,max,{optional:true});}
function nonemptyId(v,label){return text(v,label,40);}
async function appointmentOf(id){const x=await one('appointments',id,'Appointment');if(['Cancelled','No-show'].includes(x.status))throw conflict('Cancelled or missed appointments cannot have clinical records.');return x;}
async function clinicAssessmentAppointment(id){const x=await appointmentOf(id);if(!['In-progress','Completed'].includes(x.status))throw conflict('Check in and start the appointment before recording clinical orders.');return x;}
function requireMatch(provided,expected,label){if(provided && provided!==expected)throw conflict(`${label} must match the appointment.`);}
async function ensureConsultation(appointmentId){if(!await db.collection('consultations').findOne({appointment_id:appointmentId}))throw conflict('Record a consultation for this appointment first.');}
async function validate(name,b,id,old,actor){
 if(!b||typeof b!=='object'||Array.isArray(b))throw bad('A JSON object is required.');
 switch(name){
  case 'patients': {
   const year=num(b.birth_year,'Birth year',1900,new Date().getFullYear(),{integer:true});
   return {full_name:text(b.full_name,'Full name'),birth_year:year,sex:choice(b.sex,'Sex',['Female','Male','Other']),
    phone:phone(b.phone),emergency_contact:optionalText(b.emergency_contact,'Emergency contact',150),allergies:optionalText(b.allergies,'Allergies',300),
    address:{area:text(b.address?.area,'Area'),district:text(b.address?.district,'District')}};
  }
  case 'doctors':return {full_name:text(b.full_name,'Full name'),specialty:text(b.specialty,'Specialty'),department:text(b.department,'Department')};
  case 'appointments': {
   const patient_id=nonemptyId(b.patient_id,'Patient ID'),doctor_id=nonemptyId(b.doctor_id,'Doctor ID');
   await one('patients',patient_id,'Patient');await one('doctors',doctor_id,'Doctor');
   const when=date(b.scheduled_at,'Appointment time'); const status=choice(b.status,'Status',stat);
   if(!old && status!=='Scheduled')throw bad('New appointments must start with Scheduled status.');
   if(old){
    if(!appointmentStatusTransition(old.status,status))throw conflict(`Invalid appointment transition ${old.status} → ${status}.`);
    const clinical=await Promise.all(['triage','consultations','prescriptions','lab_requests','invoices'].map(c=>db.collection(c).countDocuments({appointment_id:id})));
    if(clinical.some(Boolean)&&(old.patient_id!==patient_id||old.doctor_id!==doctor_id||old.scheduled_at.getTime()!==when.getTime()))throw conflict('This appointment has related records; patient, doctor and date cannot be changed.');
    if(clinical.some(Boolean)&&['Cancelled','No-show'].includes(status))throw conflict('An appointment with clinical or billing records cannot be cancelled or marked No-show.');
   }
   if(!['Cancelled','No-show'].includes(status)){
    const clash=await db.collection('appointments').findOne({doctor_id,scheduled_at:{$gt:new Date(when.getTime()-30*60000),$lt:new Date(when.getTime()+30*60000)},status:{$nin:['Cancelled','No-show']},_id:{$ne:id||''}});
    if(clash)throw conflict(`Doctor already has an appointment at this time (${clash._id}).`);
   }
   return {patient_id,doctor_id,scheduled_at:when,status};
  }
  case 'triage':{
   const a=await appointmentOf(nonemptyId(b.appointment_id,'Appointment ID'));
   if(!['Checked-in','In-progress','Completed'].includes(a.status))throw conflict('Triage requires a checked-in or active appointment.');
   const defs={temperature_c:[30,45],systolic_bp:[60,260],diastolic_bp:[30,160],pulse_bpm:[25,240],spo2_pct:[50,100],weight_kg:[1,400]};
   const vitals={};for(const [k,[min,max]] of Object.entries(defs)) {const v=optionalNumber(b.vitals?.[k],k,min,max);if(v!==null)vitals[k]=v;}
   if(!Object.keys(vitals).length)throw bad('Enter at least one vital-sign measurement.');
   return {appointment_id:a._id,patient_id:a.patient_id,vitals,notes:optionalText(b.notes,'Nursing notes',500),recorded_at:old?.recorded_at||new Date()};
  }
  case 'consultations':{
   const a=await clinicAssessmentAppointment(nonemptyId(b.appointment_id,'Appointment ID'));
   if(old && old.appointment_id!==a._id)throw conflict('Consultation appointment cannot be reassigned.');
   requireMatch(b.patient_id,a.patient_id,'Patient');requireMatch(b.doctor_id,a.doctor_id,'Doctor');
   if(!old && await db.collection('consultations').findOne({appointment_id:a._id}))throw conflict('A consultation already exists for this appointment.');
   return {appointment_id:a._id,patient_id:a.patient_id,doctor_id:a.doctor_id,symptoms:symptoms(b.symptoms),
    vitals:{temperature_c:num(b.vitals?.temperature_c,'Temperature',30,45)},assessment:text(b.assessment,'Assessment',1000),
    diagnosis:optionalText(b.diagnosis,'Diagnosis',400),plan:optionalText(b.plan,'Plan',1000)};
  }
  case 'prescriptions':{
   const a=await clinicAssessmentAppointment(nonemptyId(b.appointment_id,'Appointment ID'));await ensureConsultation(a._id);
   if(old && old.appointment_id!==a._id)throw conflict('Prescription appointment cannot be reassigned.');
   if(old?.status==='Dispensed')throw conflict('Dispensed prescriptions are immutable.');
   return {appointment_id:a._id,patient_id:a.patient_id,doctor_id:a.doctor_id,medicine:text(b.medicine,'Medicine',180),dose:text(b.dose,'Dose'),
    route:text(b.route,'Route'),frequency:text(b.frequency,'Frequency'),duration:text(b.duration,'Duration'),status:'Prescribed'};
  }
  case 'lab_requests':{
   const a=await clinicAssessmentAppointment(nonemptyId(b.appointment_id,'Appointment ID'));
   if(old && old.appointment_id!==a._id)throw conflict('Laboratory request appointment cannot be reassigned.');
   const status=old?choice(b.status,'Status',['Requested','Collected','Completed','Cancelled']):'Requested';
   if(old?.status==='Completed' && status!=='Completed')throw conflict('Completed laboratory requests cannot be reopened.');
   if(old?.status==='Cancelled' && status!=='Cancelled')throw conflict('Cancelled laboratory requests cannot be reopened.');
   if(old && status==='Completed'&&!await db.collection('lab_results').findOne({request_id:id}))throw conflict('Record a verified laboratory result before completing the request.');
   return {appointment_id:a._id,patient_id:a.patient_id,doctor_id:a.doctor_id,test_name:text(b.test_name,'Test name',180),status};
  }
  case 'lab_results':{
   const r=await one('lab_requests',nonemptyId(b.request_id,'Laboratory request ID'),'Laboratory request');
   if(r.status==='Cancelled')throw conflict('Cannot record results for a cancelled request.');
   if(old&&old.request_id!==r._id)throw conflict('A laboratory result cannot be reassigned.');
   return {request_id:r._id,appointment_id:r.appointment_id,patient_id:r.patient_id,result:text(b.result,'Result',1500),units:optionalText(b.units,'Units',60),
     reference_range:optionalText(b.reference_range,'Reference range',160),verified_by:actor.username,reported_at:old?.reported_at||new Date()};
  }
  case 'invoices':{
   const a=await appointmentOf(nonemptyId(b.appointment_id,'Appointment ID'));
   if(old?.amount_paid>0)throw conflict('Cannot edit an invoice after receiving payment.');
   if(old && old.appointment_id!==a._id)throw conflict('Invoice appointment cannot be reassigned.');
   return {appointment_id:a._id,patient_id:a.patient_id,description:text(b.description,'Description',400),total_amount:num(b.total_amount,'Total amount UGX',1,1000000000,{integer:true}),amount_paid:0,status:'Unpaid'};
  }
  case 'payments':{
   const invoice=await one('invoices',nonemptyId(b.invoice_id,'Invoice ID'),'Invoice');
   const amount=num(b.amount,'Amount UGX',1,1000000000,{integer:true});
   if(invoice.amount_paid+amount>invoice.total_amount)throw conflict('Payment exceeds the invoice balance.');
   return {invoice_id:invoice._id,patient_id:invoice.patient_id,amount,method:choice(b.method,'Method',['Cash','Mobile Money','Card','Bank Transfer']),
    reference:optionalText(b.reference,'Reference',100),paid_at:new Date()};
  }
  default:throw bad('Unknown collection.');
 }
}
async function audit(user,action,collection,id,fields=[]) {
 try { await db.collection('audit_logs').insertOne({actor:user.username,action,collection,record_id:String(id),at:new Date(),changed_fields:fields}); }
 catch(err) { console.error('Audit write failed:',err.message); }
}
async function nextId(name){const prefix=FIELDS[name].prefix;const rows=await db.collection(name).find({_id:{$regex:`^${prefix}\\d+$`}},{projection:{_id:1}}).toArray();let max=0;for(const r of rows)max=Math.max(max,Number(r._id.slice(prefix.length))||0);return prefix+String(max+1).padStart(3,'0');}
function safeId(s){if(typeof s!=='string'||!/^[A-Za-z0-9_-]{1,30}$/.test(s))throw bad('Invalid ID.');return s;}
const demoUser={username:'Local demo'};
function allowed(name,action){return Boolean(ACCESS[name]?.[action]?.length);}
function checkAccess(name,action){if(!allowed(name,action))throw new HttpError(403,'This action is unavailable for this record type.');}
const permissions=Object.fromEntries(Object.keys(FIELDS).map(name=>[name,{
 read:allowed(name,'read'),create:allowed(name,'write'),
 edit:name!=='payments'&&allowed(name,'write'),delete:allowed(name,'delete')
}]));
app.get('/api/health',(req,res)=>res.json({status:'ok'}));
app.use('/api',(req,res,next)=>{req.user=demoUser;next();});
app.get('/api/workspace',(req,res)=>res.json({user:demoUser,permissions}));
// ---------- Dashboard and history ----------
app.get('/api/summary',wrap(async(req,res)=>{
 const out={};for(const name of Object.keys(FIELDS))if(allowed(name,'read') && name!=='audit_logs')out[name]=await db.collection(name).countDocuments();
 const offset=3*3600*1000;const t=Date.now()+offset;const start=new Date(Math.floor(t/86400000)*86400000-offset),end=new Date(start.getTime()+86400000);
 out.today_appointments=await db.collection('appointments').countDocuments({scheduled_at:{$gte:start,$lt:end}});
 out.waiting=await db.collection('appointments').countDocuments({status:'Checked-in'});
 out.lab_pending=await db.collection('lab_requests').countDocuments({status:{$in:['Requested','Collected']}});
 out.unpaid_invoices=await db.collection('invoices').countDocuments({status:{$ne:'Paid'}});
 res.json(out);
}));
app.get('/api/patients/:id/history',wrap(async(req,res)=>{
 checkAccess('patients','read');const patient=await db.collection('patients').findOne({_id:req.params.id});if(!patient)throw notFound('Patient not found.');
 const visits=await db.collection('appointments').aggregate([
  {$match:{patient_id:patient._id}},{$sort:{scheduled_at:-1}},
  ...[['doctors','doctor_id','doctor'],['consultations','_id','consultation'],['triage','_id','triage'],['prescriptions','_id','prescriptions'],['lab_requests','_id','lab_requests']].map(([from,localField,as])=>({$lookup:{from,localField,foreignField:as==='doctor'?'_id':'appointment_id',as}}))
 ]).toArray();
 res.json({patient,visits});
}));
app.patch('/api/prescriptions/:id/dispense',wrap(async(req,res)=>{
 const result=await db.collection('prescriptions').findOneAndUpdate({_id:req.params.id,status:'Prescribed'},{$set:{status:'Dispensed',dispensed_at:new Date()}},{returnDocument:'after'});
 if(!result)throw conflict('Prescription is missing or already dispensed.');
 await audit(req.user,'DISPENSE','prescriptions',req.params.id,['status']);res.json(result);
}));
app.param('col',(req,res,next,col)=>Object.hasOwn(FIELDS,col)?next():next(notFound('Unknown collection.')));
app.get('/api/:col',wrap(async(req,res)=>{
 const name=req.params.col;checkAccess(name,'read');const query={};
 if(req.query.q){const q=String(req.query.q).trim().slice(0,90).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); if(q)query.$or=FIELDS[name].search.map(f=>({[f]:{$regex:q,$options:'i'}}));}
 for(const f of ['patient_id','doctor_id','appointment_id','status','invoice_id'])if(req.query[f]&&FIELDS[name].search.includes(f))query[f]=String(req.query[f]).slice(0,60);
 const limit=Math.min(500,Math.max(1,Number(req.query.limit)||200));const page=Math.min(1000,Math.max(1,Number(req.query.page)||1));
 const cursor=db.collection(name).find(query).sort(name==='audit_logs'?{at:-1}:{_id:1}).skip((page-1)*limit).limit(limit);
 res.json(await cursor.toArray());
}));
app.get('/api/:col/:id',wrap(async(req,res)=>{
 const name=req.params.col;checkAccess(name,'read');const row=await db.collection(name).findOne({_id:req.params.id});if(!row)throw notFound();res.json(row);
}));
app.post('/api/:col',wrap(async(req,res)=>{
 const name=req.params.col;checkAccess(name,'write');if(name==='audit_logs')throw new HttpError(403,'Audit records are read-only.');
 if(name==='payments'){
  const p=await validate('payments',req.body||{},null,null,req.user);
  // Atomic invoice total/status change prevents overpayment on concurrent requests.
  // The companion payment document is still a separate write on standalone MongoDB.
  const available=await db.collection('invoices').findOneAndUpdate(
   {_id:p.invoice_id,$expr:{$lte:[{$add:['$amount_paid',p.amount]},'$total_amount']}},
   [{$set:{amount_paid:{$add:['$amount_paid',p.amount]}}},{$set:{status:{$cond:[{$eq:['$amount_paid','$total_amount']},'Paid','Part-paid']}}}],
   {returnDocument:'after'});
  if(!available)throw conflict('Invoice is missing or payment exceeds the unpaid balance.');
  const id=safeId(req.body?._id||await nextId('payments'));
  try {await db.collection('payments').insertOne({_id:id,...p});}
  catch(err){
   await db.collection('invoices').updateOne({_id:p.invoice_id},[
    {$set:{amount_paid:{$subtract:['$amount_paid',p.amount]}}},
    {$set:{status:{$cond:[{$eq:['$amount_paid',0]},'Unpaid',{$cond:[{$eq:['$amount_paid','$total_amount']},'Paid','Part-paid']}]}}}]);
   throw err;
  }
  await audit(req.user,'CREATE','payments',id,Object.keys(p));return res.status(201).json({_id:id,...p});
 }
 const b=req.body||{};const id=safeId(b._id||await nextId(name));
 if(await db.collection(name).findOne({_id:id},{projection:{_id:1}}))throw conflict(`ID ${id} already exists.`);
 const data=await validate(name,b,null,null,req.user);const doc={_id:id,...data};
 await db.collection(name).insertOne(doc);await audit(req.user,'CREATE',name,id,Object.keys(data));res.status(201).json(doc);
}));
app.put('/api/:col/:id',wrap(async(req,res)=>{
 const name=req.params.col;checkAccess(name,'write');if(['payments','audit_logs'].includes(name))throw new HttpError(403,'This record type cannot be manually edited.');
 const old=await db.collection(name).findOne({_id:req.params.id});if(!old)throw notFound();
 const data=await validate(name,req.body||{},req.params.id,old,req.user);
 await db.collection(name).updateOne({_id:req.params.id},{$set:data});
 await audit(req.user,'UPDATE',name,req.params.id,Object.keys(data));res.json({...old,...data});
}));
app.delete('/api/:col/:id',wrap(async(req,res)=>{
 const name=req.params.col;checkAccess(name,'delete');if(!['patients','doctors','appointments','consultations','triage','invoices'].includes(name))throw new HttpError(403,'Deletion is disabled for this record type.');
 const old=await db.collection(name).findOne({_id:req.params.id});if(!old)throw notFound();
 const refs={
  patients:[['appointments','patient_id'],['triage','patient_id'],['consultations','patient_id'],['prescriptions','patient_id'],['lab_requests','patient_id'],['lab_results','patient_id'],['invoices','patient_id'],['payments','patient_id']],
  doctors:[['appointments','doctor_id'],['consultations','doctor_id']],
  appointments:[['consultations','appointment_id'],['triage','appointment_id'],['prescriptions','appointment_id'],['lab_requests','appointment_id'],['lab_results','appointment_id'],['invoices','appointment_id']],
  consultations:[['prescriptions','appointment_id'],['lab_requests','appointment_id']],
  triage:[],invoices:[['payments','invoice_id']]
 }[name];
 for(const [c,field] of refs){if(await db.collection(c).countDocuments({[field]:name==='consultations'?old.appointment_id:req.params.id}))throw conflict(`Cannot delete this record: ${c} still references it.`);}
 await db.collection(name).deleteOne({_id:req.params.id});await audit(req.user,'DELETE',name,req.params.id);res.json({deleted:req.params.id});
}));
app.use('/api',(req,res,next)=>next(notFound('API endpoint not found.')));
app.use((err,req,res,next)=>{
 if(err.type==='entity.parse.failed')return res.status(400).json({error:'Invalid JSON request.'});
 if(err.code===11000)return res.status(409).json({error:'Duplicate ID or unique relationship.'});
 if(err.code===121)return res.status(400).json({error:'Database validation rejected this document.'});
 const status=err.status||500;if(status===500)console.error(err);res.status(status).json({error:status===500?'Internal server error.':err.message});
});
if(require.main===module){(async()=>{try{const {client,db:database}=await connect();db=database;await setupSchema(db);
 const host = process.env.RENDER_EXTERNAL_HOSTNAME ? '0.0.0.0' : '127.0.0.1';
const server = app.listen(PORT, host, () => console.log(`Clinic listening on port ${PORT}`));
 const stop=async()=>{server.close();await client.close();process.exit(0);};process.on('SIGTERM',stop);process.on('SIGINT',stop);
 }catch(e){console.error('Clinic startup failed:',e.message);process.exitCode=1;}})();}
module.exports={app,validate,FIELDS};
