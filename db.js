'use strict';
const {MongoClient}=require('mongodb');
const MONGO_URI=process.env.MONGO_URI||'mongodb://127.0.0.1:27017';
const DB_NAME=process.env.DB_NAME||'health_clinic_db';
const NUMBER=['int','long','double','decimal'];
const S=(extra={})=>({bsonType:'string',...extra});
const D={bsonType:'date'};
const N=(min,max)=>({bsonType:NUMBER,minimum:min,maximum:max});
const ref=(a)=>Object.assign({bsonType:'object',required:['_id']},a);
const schemas={
 patients: {required:['_id','full_name','birth_year','sex','address'],properties:{_id:S(),full_name:S({minLength:1}),birth_year:N(1900,2100),sex:S({enum:['Female','Male','Other']}),phone:S(),emergency_contact:S(),allergies:S(),address:{bsonType:'object',required:['area','district'],properties:{area:S(),district:S()}}}},
 doctors:{required:['_id','full_name','specialty','department'],properties:{_id:S(),full_name:S(),specialty:S(),department:S()}},
 appointments:{required:['_id','patient_id','doctor_id','scheduled_at','status'],properties:{_id:S(),patient_id:S(),doctor_id:S(),scheduled_at:D,status:S({enum:['Scheduled','Checked-in','In-progress','Completed','Cancelled','No-show']})}},
 consultations:{required:['_id','appointment_id','patient_id','doctor_id','symptoms','vitals','assessment'],properties:{_id:S(),appointment_id:S(),patient_id:S(),doctor_id:S(),symptoms:{bsonType:'array',minItems:1,items:S()},vitals:{bsonType:'object',properties:{temperature_c:N(30,45)}},assessment:S(),diagnosis:S(),plan:S()}},
 triage:{required:['_id','appointment_id','patient_id','recorded_at','vitals'],properties:{_id:S(),appointment_id:S(),patient_id:S(),recorded_at:D,notes:S(),vitals:{bsonType:'object',minProperties:1,properties:{temperature_c:N(30,45),systolic_bp:N(60,260),diastolic_bp:N(30,160),pulse_bpm:N(25,240),spo2_pct:N(50,100),weight_kg:N(1,400)}}}},
 prescriptions:{required:['_id','appointment_id','patient_id','doctor_id','medicine','dose','route','frequency','duration','status'],properties:{_id:S(),appointment_id:S(),patient_id:S(),doctor_id:S(),medicine:S(),dose:S(),route:S(),frequency:S(),duration:S(),status:S({enum:['Prescribed','Dispensed']}),dispensed_at:D}},
 lab_requests:{required:['_id','appointment_id','patient_id','doctor_id','test_name','status'],properties:{_id:S(),appointment_id:S(),patient_id:S(),doctor_id:S(),test_name:S(),status:S({enum:['Requested','Collected','Completed','Cancelled']})}},
 lab_results:{required:['_id','request_id','appointment_id','patient_id','result','verified_by'],properties:{_id:S(),request_id:S(),appointment_id:S(),patient_id:S(),result:S(),units:S(),reference_range:S(),verified_by:S(),reported_at:D}},
 invoices:{required:['_id','appointment_id','patient_id','description','total_amount','amount_paid','status'],properties:{_id:S(),appointment_id:S(),patient_id:S(),description:S(),total_amount:N(1,1000000000),amount_paid:N(0,1000000000),status:S({enum:['Unpaid','Part-paid','Paid']})}},
 payments:{required:['_id','invoice_id','patient_id','amount','method','paid_at'],properties:{_id:S(),invoice_id:S(),patient_id:S(),amount:N(1,1000000000),method:S(),reference:S(),paid_at:D}},
 users:{required:['_id','username','password_hash','role','active'],properties:{_id:S(),username:S(),password_hash:S(),role:S({enum:['admin','reception','nurse','clinician','lab','pharmacy','cashier']}),active:{bsonType:'bool'}}},
 sessions:{required:['_id','username','role','csrf','expires_at'],properties:{_id:S(),username:S(),role:S(),csrf:S(),expires_at:D}},
 audit_logs:{required:['actor','action','collection','record_id','at'],properties:{actor:S(),action:S(),collection:S(),record_id:S(),at:D,changed_fields:{bsonType:'array',items:S()}}}
};
async function connect(){const client=new MongoClient(MONGO_URI,{serverSelectionTimeoutMS:5000});await client.connect();return {client,db:client.db(DB_NAME)};}
async function setupSchema(db){
 const existing=new Set((await db.listCollections({},{nameOnly:true}).toArray()).map(x=>x.name));
 for(const [name,shape] of Object.entries(schemas)){
  const schema={bsonType:'object',...shape};
  if(!existing.has(name)) await db.createCollection(name,{validator:{$jsonSchema:schema},validationLevel:'moderate'});
  else await db.command({collMod:name,validator:{$jsonSchema:schema},validationLevel:'moderate'});
 }
 const unique=(col,fields)=>db.collection(col).createIndex(fields,{unique:true});
 await unique('consultations',{appointment_id:1});
 await unique('triage',{appointment_id:1});
 await unique('lab_results',{request_id:1});
 await unique('users',{username:1});
 await db.collection('sessions').createIndex({expires_at:1},{expireAfterSeconds:0});
 await db.collection('appointments').createIndex({doctor_id:1,scheduled_at:1},{unique:true,partialFilterExpression:{status:{$in:['Scheduled','Checked-in','In-progress','Completed']}}});
 await db.collection('appointments').createIndex({patient_id:1,scheduled_at:-1});
 for (const [col,field] of [['prescriptions','appointment_id'],['lab_requests','appointment_id'],['invoices','appointment_id'],['payments','invoice_id'],['audit_logs','at']]) await db.collection(col).createIndex({[field]:1});
}
module.exports={connect,setupSchema,DB_NAME,MONGO_URI,schemas};
