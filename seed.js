// Loads 40 sample documents: the 20 from the assignment (P001-P005, D001-D005, A001-A005, C001-C005)
// plus 20 extra records (P006-P010, D006-D008, A006-A012, C006-C010) for robustness testing.
// Usage:  npm run seed          (inserts/updates the samples, keeps your other data)
//         npm run seed:reset    (empties the four collections first)
const { connect, setupSchema, DB_NAME } = require('./db');

const patients = [
  { _id: 'P001', full_name: 'Sarah Namutebi', birth_year: 1994, sex: 'Female', address: { area: 'Ntinda', district: 'Kampala' } },
  { _id: 'P002', full_name: 'David Okello', birth_year: 1987, sex: 'Male', address: { area: 'Nakawa', district: 'Kampala' } },
  { _id: 'P003', full_name: 'Grace Achen', birth_year: 2001, sex: 'Female', address: { area: 'Kisaasi', district: 'Kampala' } },
  { _id: 'P004', full_name: 'Peter Ssemanda', birth_year: 1978, sex: 'Male', address: { area: 'Bukoto', district: 'Kampala' } },
  { _id: 'P005', full_name: 'Ruth Atim', birth_year: 1998, sex: 'Female', address: { area: 'Kawempe', district: 'Kampala' } },
  // ---- extra records for robustness testing ----
  { _id: 'P006', full_name: 'Joan Nabirye', birth_year: 2016, sex: 'Female', address: { area: 'Entebbe Town', district: 'Wakiso' } }, // child, different district
  { _id: 'P007', full_name: "Moses O'Neil Kiggundu", birth_year: 1952, sex: 'Male', address: { area: 'Seeta', district: 'Mukono' } }, // apostrophe + oldest patient
  { _id: 'P008', full_name: 'Amina Nakato-Byaruhanga', birth_year: 1990, sex: 'Female', address: { area: 'Makindye', district: 'Kampala' } }, // hyphenated name
  { _id: 'P009', full_name: 'Tonny Mugisha', birth_year: 2009, sex: 'Other', address: { area: 'Kyengera', district: 'Wakiso' } }, // "Other" sex option
  { _id: 'P010', full_name: 'Lillian Akullo', birth_year: 1985, sex: 'Female', address: { area: 'Rubaga', district: 'Kampala' } } // no appointments: can be deleted freely
];

const doctors = [
  { _id: 'D001', full_name: 'Alice Nambasa', specialty: 'General practice', department: 'Outpatient' },
  { _id: 'D002', full_name: 'Brian Ouma', specialty: 'General practice', department: 'Outpatient' },
  { _id: 'D003', full_name: 'Clara Nakitto', specialty: 'General practice', department: 'Outpatient' },
  { _id: 'D004', full_name: 'Daniel Kato', specialty: 'General practice', department: 'Outpatient' },
  { _id: 'D005', full_name: 'Esther Akello', specialty: 'General practice', department: 'Outpatient' },
  // ---- extra records ----
  { _id: 'D006', full_name: 'Fred Mwesigwa', specialty: 'Paediatrics', department: 'Children\'s Ward' },
  { _id: 'D007', full_name: 'Gloria Nansubuga', specialty: 'Internal medicine', department: 'Medical Ward' },
  { _id: 'D008', full_name: 'Henry Opio', specialty: 'Dentistry', department: 'Dental Clinic' } // no appointments: can be deleted freely
];

const appointments = [
  ['A001', 'P001', 'D001', '2026-10-12T06:00:00Z', 'Completed'],
  ['A002', 'P002', 'D002', '2026-10-12T06:30:00Z', 'Completed'],
  ['A003', 'P003', 'D003', '2026-10-12T07:00:00Z', 'Completed'],
  ['A004', 'P004', 'D004', '2026-10-12T07:30:00Z', 'Completed'],
  ['A005', 'P005', 'D005', '2026-10-12T08:00:00Z', 'Completed'],
  // ---- extra records ----
  ['A006', 'P006', 'D006', '2026-10-19T06:00:00Z', 'Completed'],
  ['A007', 'P001', 'D001', '2026-10-26T07:00:00Z', 'Completed'], // repeat patient (P001 now has 2 visits)
  ['A008', 'P007', 'D006', '2026-10-26T08:00:00Z', 'Completed'], // same doctor as A006
  ['A009', 'P008', 'D007', '2026-11-02T06:30:00Z', 'Completed'],
  ['A010', 'P009', 'D007', '2026-11-02T07:30:00Z', 'Completed'], // same doctor as A009
  ['A011', 'P002', 'D002', '2026-11-20T07:00:00Z', 'Scheduled'], // future visit, no consultation yet
  ['A012', 'P003', 'D003', '2026-11-05T06:00:00Z', 'Cancelled']  // cancelled, no consultation
].map(([_id, patient_id, doctor_id, when, status]) => ({
  _id, patient_id, doctor_id, scheduled_at: new Date(when), status
}));

const consultations = [
  ['C001', 'A001', 'P001', 'D001', ['Headache'], 37.0, 'Further clinical review recorded'],
  ['C002', 'A002', 'P002', 'D002', ['Cough'], 37.2, 'Further clinical review recorded'],
  ['C003', 'A003', 'P003', 'D003', ['Fatigue'], 36.8, 'Further clinical review recorded'],
  ['C004', 'A004', 'P004', 'D004', ['Back pain'], 36.7, 'Further clinical review recorded'],
  ['C005', 'A005', 'P005', 'D005', ['Sore throat'], 37.1, 'Further clinical review recorded'],
  // ---- extra records ----
  ['C006', 'A006', 'P006', 'D006', ['Fever', 'Loss of appetite'], 38.6, 'Follow-up visit advised'], // several symptoms, high temperature
  ['C007', 'A007', 'P001', 'D001', ['Headache', 'Dizziness', 'Nausea'], 36.9, 'Further clinical review recorded'], // three symptoms
  ['C008', 'A008', 'P007', 'D006', ['Joint pain'], 36.4, 'Referred for further tests'], // low temperature
  ['C009', 'A009', 'P008', 'D007', ['Abdominal pain', 'Vomiting'], 37.8, 'Further clinical review recorded'],
  ['C010', 'A010', 'P009', 'D007', ['Skin rash'], 37.3, 'Further clinical review recorded']
].map(([_id, appointment_id, patient_id, doctor_id, symptoms, temp, assessment]) => ({
  _id, appointment_id, patient_id, doctor_id,
  symptoms,
  vitals: { temperature_c: temp },
  assessment
}));

// Extra fictional examples for the expanded clinic workflow. Never use for real care.
const triage = [
  {_id:'T001',appointment_id:'A006',patient_id:'P006',recorded_at:new Date('2026-10-19T06:10:00Z'),vitals:{temperature_c:38.6,pulse_bpm:96,spo2_pct:98},notes:'Sample classroom record'},
  {_id:'T002',appointment_id:'A007',patient_id:'P001',recorded_at:new Date('2026-10-26T07:10:00Z'),vitals:{temperature_c:36.9,pulse_bpm:78},notes:'Sample classroom record'}
];
const lab_requests = [{_id:'LR001',appointment_id:'A006',patient_id:'P006',doctor_id:'D006',test_name:'Full blood count (sample)',status:'Requested'}];
const invoices = [
 {_id:'I001',appointment_id:'A001',patient_id:'P001',description:'Example consultation fee',total_amount:40000,amount_paid:0,status:'Unpaid'},
 {_id:'I002',appointment_id:'A006',patient_id:'P006',description:'Example outpatient services',total_amount:60000,amount_paid:30000,status:'Part-paid'}
];
const payments = [{_id:'PM001',invoice_id:'I002',patient_id:'P006',amount:30000,method:'Mobile Money',reference:'FICTIONAL-DEMO-001',paid_at:new Date('2026-10-19T08:00:00Z')}];
const data = { patients, doctors, appointments, consultations, triage, lab_requests, invoices, payments };

(async () => {
  let client;
  try {
    const conn=await connect();client=conn.client;const db=conn.db;
    await setupSchema(db);
    const reset=process.argv.includes('--reset');
    if(reset && !(process.env.CLINIC_ALLOW_DEMO_RESET==='YES' && DB_NAME.endsWith('_demo')))
      throw new Error('Reset is only permitted for an explicitly named *_demo database with CLINIC_ALLOW_DEMO_RESET=YES.');
    if(reset) {
      for(const name of Object.keys(data).reverse())await db.collection(name).deleteMany({});
      console.log('Only demonstration collections reset. User accounts preserved.');
    }
    for (const [name, docs] of Object.entries(data)) {
      for(const doc of docs) await db.collection(name).updateOne({_id:doc._id},{$setOnInsert:doc},{upsert:true});
      const count=await db.collection(name).countDocuments();
      console.log(`${name}: ${count} documents (existing records preserved)`);
    }
    console.log(`Done. Database "${DB_NAME}" is ready.`);
  }catch(err){console.error('Sample seeding failed:',err.message);process.exitCode=1;}
  finally {if(client)await client.close();}
})();
