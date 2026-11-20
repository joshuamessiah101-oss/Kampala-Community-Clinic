'use strict';
const TZ='Africa/Kampala';
const $=id=>document.getElementById(id);
const text=v=>String(v??'');
const esc=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const get=(obj,path)=>path.split('.').reduce((o,k)=>o?.[k],obj);
function set(obj,path,val){const p=path.split('.');let x=obj;for(const k of p.slice(0,-1))x=x[k]??={};x[p.at(-1)]=val;}
function dateLabel(d){if(!d)return '';try{return new Date(d).toLocaleString('en-GB',{timeZone:TZ,dateStyle:'medium',timeStyle:'short'});}catch{return text(d);}}
function eatInput(iso){if(!iso)return '';const d=new Date(iso);const parts=new Intl.DateTimeFormat('en-GB',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d);const t=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${t.year}-${t.month}-${t.day}T${t.hour}:${t.minute}`;}
function dateForApi(v){return v?new Date(v+':00+03:00').toISOString():'';}
const col=(name,label,type='text',more={})=>({name,label,type,...more});
const ref=(name,label,collection,more={})=>col(name,label,'ref',{ref:collection,...more});
const opts=(name,label,options,more={})=>col(name,label,'select',{options,...more});
const number=(name,label,min=0,max=1000000000,more={})=>col(name,label,'number',{min,max,...more});
const items={
 patients:{label:'Patients',one:'patient',title:'Patient directory',description:'Registration, demographics and contacts',columns:['_id','full_name','phone','birth_year','sex',r=>`${r.address?.area||''}, ${r.address?.district||''}`],heads:['ID','Patient','Telephone','Birth year','Sex','Location'],fields:[col('full_name','Full name'),number('birth_year','Birth year',1900,2100,{step:1}),opts('sex','Sex',['Female','Male','Other']),col('phone','Telephone'),col('emergency_contact','Emergency contact'),col('allergies','Allergies (or Unknown)'),col('address.area','Area'),col('address.district','District')],history:true},
 doctors:{label:'Doctors',one:'doctor',title:'Clinical team',description:'Doctors and departments',columns:['_id','full_name','specialty','department'],heads:['ID','Name','Specialty','Department'],fields:[col('full_name','Doctor name'),col('specialty','Specialty'),col('department','Department')]},
 appointments:{label:'Appointments',one:'appointment',title:'Appointments',description:'Booking, check-in and clinical visit status',columns:['_id',r=>nameOf('patients',r.patient_id),r=>nameOf('doctors',r.doctor_id),r=>dateLabel(r.scheduled_at),'status'],heads:['ID','Patient','Doctor','Scheduled • EAT','Status'],fields:[ref('patient_id','Patient','patients'),ref('doctor_id','Doctor','doctors'),col('scheduled_at','Date and time (EAT)','datetime'),opts('status','Appointment status',['Scheduled','Checked-in','In-progress','Completed','Cancelled','No-show'])]},
 triage:{label:'Triage',one:'triage record',title:'Nursing triage',description:'Recorded vital signs and nursing notes',columns:['_id','appointment_id',r=>nameOf('patients',r.patient_id),r=>dateLabel(r.recorded_at),r=>Object.entries(r.vitals||{}).map(([k,v])=>`${k}: ${v}`).join(' · ')],heads:['ID','Appointment','Patient','Recorded','Vital signs'],fields:[ref('appointment_id','Appointment','appointments',{statuses:['Checked-in','In-progress','Completed']}),number('vitals.temperature_c','Temperature °C',30,45,{step:.1,optional:true}),number('vitals.systolic_bp','Systolic BP',60,260,{optional:true}),number('vitals.diastolic_bp','Diastolic BP',30,160,{optional:true}),number('vitals.pulse_bpm','Pulse / min',25,240,{optional:true}),number('vitals.spo2_pct','SpO₂ %',50,100,{optional:true}),number('vitals.weight_kg','Weight (kg)',1,400,{optional:true,step:.1}),col('notes','Nursing notes','textarea')]},
 consultations:{label:'Consultations',one:'consultation',title:'Consultation notes',description:'History, examination and clinical assessment',columns:['_id','appointment_id',r=>nameOf('patients',r.patient_id),r=>(r.symptoms||[]).join(', '),'assessment','diagnosis'],heads:['ID','Appointment','Patient','Symptoms','Assessment','Diagnosis'],fields:[ref('appointment_id','Appointment','appointments',{statuses:['In-progress','Completed'],unused:true}),col('symptoms','Symptoms (comma-separated)'),number('vitals.temperature_c','Temperature °C',30,45,{step:.1}),col('assessment','Clinical assessment','textarea'),col('diagnosis','Diagnosis or provisional impression','textarea'),col('plan','Plan and follow-up','textarea')]},
 prescriptions:{label:'Pharmacy',one:'prescription',title:'Prescriptions',description:'Clinician-authored orders and dispensing status',columns:['_id','appointment_id','medicine','dose','route','frequency','duration','status'],heads:['ID','Appointment','Medicine','Dose','Route','Frequency','Duration','Status'],fields:[ref('appointment_id','Appointment','appointments',{statuses:['In-progress','Completed']}),col('medicine','Medicine'),col('dose','Dose as prescribed'),col('route','Route'),col('frequency','Frequency'),col('duration','Duration')],pharmacy:true},
 lab_requests:{label:'Lab requests',one:'test request',title:'Laboratory requests',description:'Tests ordered by clinicians',columns:['_id','appointment_id','test_name','status'],heads:['ID','Appointment','Test','Status'],fields:[ref('appointment_id','Appointment','appointments',{statuses:['In-progress','Completed']}),col('test_name','Test name'),opts('status','Status',['Requested','Collected','Completed','Cancelled'])]},
 lab_results:{label:'Lab results',one:'lab result',title:'Laboratory results',description:'Results verified by laboratory staff',columns:['_id','request_id','result','units','reference_range','verified_by'],heads:['ID','Request','Result','Units','Reference','Verified by'],fields:[ref('request_id','Laboratory request','lab_requests'),col('result','Result','textarea'),col('units','Units'),col('reference_range','Reference range')]},
 invoices:{label:'Invoices',one:'invoice',title:'Invoices',description:'Charges and outstanding balances in UGX',columns:['_id','appointment_id','description',r=>money(r.total_amount),r=>money(r.amount_paid),'status'],heads:['ID','Appointment','Description','Total (UGX)','Paid (UGX)','Status'],fields:[ref('appointment_id','Appointment','appointments'),col('description','Charge description'),number('total_amount','Total amount (UGX)',1,1000000000,{step:1})]},
 payments:{label:'Payments',one:'payment',title:'Payments',description:'Recorded receipts and payment references',columns:['_id','invoice_id',r=>money(r.amount),'method','reference',r=>dateLabel(r.paid_at)],heads:['ID','Invoice','Paid (UGX)','Method','Reference','Date'],fields:[ref('invoice_id','Invoice','invoices'),number('amount','Amount (UGX)',1,1000000000,{step:1}),opts('method','Payment method',['Cash','Mobile Money','Card','Bank Transfer']),col('reference','Transaction reference')]},
 audit_logs:{label:'Audit trail',one:'audit event',title:'Audit trail',description:'Who changed what and when',columns:['actor','action','collection','record_id',r=>dateLabel(r.at)],heads:['Staff','Action','Collection','Record ID','Time'],fields:[]}
};
const refs={patients:[],doctors:[],appointments:[],triage:[],consultations:[],prescriptions:[],lab_requests:[],lab_results:[],invoices:[],payments:[],audit_logs:[]};
let state={permissions:{}},current='dashboard',editing=null,summary={};
function money(v){return Number(v||0).toLocaleString('en-UG',{maximumFractionDigits:0});}
function nameOf(collection,id){const x=refs[collection].find(r=>r._id===id);return x?`${x.full_name} (${id})`:id;}
function note(msg,error=false){const e=$('message');e.textContent=msg;e.className='alert'+(error?' error':'');e.hidden=false;clearTimeout(note.timer);note.timer=setTimeout(()=>e.hidden=true,6500);}
async function api(url,method='GET',body){const r=await fetch('/api'+url,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`Request failed (${r.status})`);return d;}
function showWorkspace(payload){state=payload;$('workspace').hidden=false;}
async function refresh(){for(const c of Object.keys(refs))if(!state.permissions[c]?.read)refs[c]=[];
 await Promise.all(Object.keys(refs).filter(c=>state.permissions[c]?.read).map(async c=>{refs[c]=await api('/'+c+'?limit=500');}));
 summary=await api('/summary');tabs();render();}
function tabs(){const list=[['dashboard','Overview'],...Object.keys(items).filter(c=>state.permissions[c]?.read).map(c=>[c,items[c].label])];$('tabs').innerHTML=list.map(([key,label])=>`<button data-tab="${key}" class="${current===key?'active':''}">${esc(label)}</button>`).join('');}
function render(){tabs();if(current!=='dashboard'&&!state.permissions[current]?.read)current='dashboard';const dash=current==='dashboard';$('dashboard').hidden=!dash;$('recordsSection').hidden=dash;if(dash){renderDashboard();return;}
 const schema=items[current];$('moduleTitle').textContent=schema.title;$('moduleHint').textContent=schema.description;
 $('addBtn').hidden=!state.permissions[current]?.create;$('addBtn').textContent='+ Add '+schema.one;
 const q=$('search').value.trim().toLowerCase();const rows=refs[current].filter(r=>!q||JSON.stringify(r).toLowerCase().includes(q)||([r.patient_id&&nameOf('patients',r.patient_id),r.doctor_id&&nameOf('doctors',r.doctor_id)].filter(Boolean).join(' ').toLowerCase().includes(q)));
 const heads=schema.heads.map(h=>`<th>${esc(h)}</th>`).join('')+'<th>Actions</th>';
 const body=rows.map(r=>{const cells=schema.columns.map(k=>`<td>${esc(typeof k==='function'?k(r):get(r,k))}</td>`).join('');const buttons=[schema.history?`<button class="small" data-action="history" data-id="${esc(r._id)}">History</button>`:'',state.permissions[current]?.edit?`<button class="small" data-action="edit" data-id="${esc(r._id)}">Edit</button>`:'',state.permissions[current]?.delete?`<button class="small danger" data-action="delete" data-id="${esc(r._id)}">Delete</button>`:'',schema.pharmacy&&r.status==='Prescribed'?`<button class="small primary" data-action="dispense" data-id="${esc(r._id)}">Dispense</button>`:''].join('');return `<tr>${cells}<td><div class="row-buttons">${buttons}</div></td></tr>`;}).join('');
 $('table').innerHTML=`<thead><tr>${heads}</tr></thead><tbody>${body}</tbody>`;$('empty').hidden=!!rows.length;}
function renderDashboard(){const basic=[['Appointments today',summary.today_appointments],['Checked in',summary.waiting],['Lab pending',summary.lab_pending],['Unpaid invoices',summary.unpaid_invoices]];
 const extras=Object.entries(summary).filter(([k])=>!['today_appointments','waiting','lab_pending','unpaid_invoices'].includes(k)).map(([k,v])=>[items[k]?.label||k,v]);
 $('dashboard').innerHTML=`<div class="welcome"><div class="eyebrow">CLINIC OVERVIEW</div><h2>Kampala Community Clinic</h2><p>Care coordination, record keeping and operational activity at a glance.</p></div><div class="stats">${[...basic,...extras].map(([label,n])=>`<div class="stat"><span>${esc(label)}</span><strong>${esc(n)}</strong></div>`).join('')}</div><div class="dashboard-panels"><section class="panel"><h3>Daily clinic workflow</h3><ol><li>Register or locate a patient.</li><li>Book appointment and check in the patient.</li><li>Record triage and mark visit In-progress.</li><li>Document consultation and clinical orders.</li><li>Verify results, dispense prescribed medicines, issue invoice and record payment.</li></ol></section><section class="panel"><h3>Local demonstration</h3><p>All figures are based on the currently connected MongoDB database. This is an academic demonstration, not a live-care deployment.</p></section></div>`;
}
function renderField(f,rec){const id='field_'+f.name.replaceAll('.','_');let v=rec?get(rec,f.name):(f.value??'');if(v==null)v='';
 let ctrl='';if(f.type==='select'){ctrl=`<select id="${id}">${f.options.map(o=>`<option value="${esc(o)}" ${text(v===false?'false':(v??f.options[0]))===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`;}
 else if(f.type==='ref'){let list=refs[f.ref];if(f.statuses)list=list.filter(r=>f.statuses.includes(r.status));if(f.unused){const used=new Set(refs.consultations.map(c=>c.appointment_id));list=list.filter(r=>!used.has(r._id)||r._id===v);}
 ctrl=`<select id="${id}" required><option value="">Select ${esc(f.label.toLowerCase())}</option>${list.map(r=>`<option value="${esc(r._id)}" ${v===r._id?'selected':''}>${esc(r.full_name||r.test_name||r.description||r._id)} (${esc(r._id)})</option>`).join('')}</select>`;
 } else if(f.type==='textarea'){ctrl=`<textarea id="${id}" rows="3">${esc(v)}</textarea>`;}
 else if(f.type==='datetime'){ctrl=`<input id="${id}" type="datetime-local" value="${v?esc(eatInput(v)):''}">`;}
 else {const attrs=['min','max','step'].filter(k=>f[k]!==undefined).map(k=>`${k}="${f[k]}"`).join(' ');ctrl=`<input id="${id}" type="${f.type==='number'?'number':'text'}" ${attrs} value="${esc(v)}">`;}
 return `<label class="field">${esc(f.label)}${ctrl}</label>`;
}
function openForm(id){editing=id||null;const schema=items[current];const record=id?refs[current].find(x=>x._id===id):null;
 $('formTitle').textContent=record?`Edit ${schema.one} ${id}`:`New ${schema.one}`;
 const idInput=`<label class="field">Record ID (optional)<input id="field__id" value="${esc(id||'')}" ${record?'disabled':''} placeholder="Auto-generate when blank"></label>`;
 $('formFields').innerHTML=idInput+schema.fields.map(f=>renderField(f,record)).join('');$('formError').hidden=true;$('formDialog').showModal();}
function formBody(){const b={};if(!editing){const id=$('field__id').value.trim();if(id)b._id=id;}
 for(const f of items[current].fields){const e=$('field_'+f.name.replaceAll('.','_'));let v=e.value;if(f.type==='number')v=v===''?'':Number(v);if(f.type==='datetime')v=dateForApi(v);set(b,f.name,v);}return b;}
async function save(e){e.preventDefault();try{const body=formBody();if(editing)await api('/'+current+'/'+encodeURIComponent(editing),'PUT',body);else await api('/'+current,'POST',body);
 $('formDialog').close();await refresh();note(editing?'Record updated.':'Record created.');}catch(err){$('formError').hidden=false;$('formError').textContent=err.message;}}
async function remove(id){if(!confirm(`Delete ${id}? This cannot be undone. Only delete test records.`))return;try{await api('/'+current+'/'+encodeURIComponent(id),'DELETE');await refresh();note(id+' deleted.');}catch(err){note(err.message,true);}}
async function dispense(id){if(!confirm(`Confirm dispensing for prescription ${id}?`))return;try{await api('/prescriptions/'+encodeURIComponent(id)+'/dispense','PATCH',{});await refresh();note('Prescription marked dispensed.');}catch(err){note(err.message,true);}}
async function history(id){try{const d=await api('/patients/'+encodeURIComponent(id)+'/history');const rows=d.visits.map(v=>{
 const consult=v.consultation?.[0],triage=v.triage?.[0],labs=v.lab_requests||[],rx=v.prescriptions||[];
 return `<section class="visit"><strong>${esc(dateLabel(v.scheduled_at))}</strong> · ${esc(v.status)}<p class="muted">${esc(v._id)} with ${esc(v.doctor?.[0]?.full_name||v.doctor_id)}</p>${triage?`<p>Vitals: ${esc(JSON.stringify(triage.vitals))}</p>`:''}${consult?`<p><strong>Symptoms:</strong> ${esc((consult.symptoms||[]).join(', '))}<br><strong>Assessment:</strong> ${esc(consult.assessment)}<br><strong>Diagnosis:</strong> ${esc(consult.diagnosis||'Not recorded')}</p>`:''}${rx.length?`<p>Prescriptions: ${esc(rx.map(x=>x.medicine).join(', '))}</p>`:''}${labs.length?`<p>Lab requests: ${esc(labs.map(x=>x.test_name).join(', '))}</p>`:''}</section>`;}).join('');
 $('historyBody').innerHTML=`<h3>${esc(d.patient.full_name)} (${esc(d.patient._id)})</h3><p class="muted">${esc(d.patient.address?.area)}, ${esc(d.patient.address?.district)}</p>${rows||'<p>No appointments recorded.</p>'}`;$('historyDialog').showModal();}catch(err){note(err.message,true);}}
function dashboardError(err){
 const box=$('dashboardError');
 box.textContent=err.message;
 box.hidden=false;
}
$('tabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;current=b.dataset.tab;$('search').value='';render();});
$('table').addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;const id=b.dataset.id;switch(b.dataset.action){case 'history':history(id);break;case 'edit':openForm(id);break;case 'delete':remove(id);break;case 'dispense':dispense(id);break;}});
$('addBtn').addEventListener('click',()=>openForm(null));
$('form').addEventListener('submit',save);
$('cancelBtn').addEventListener('click',()=>$('formDialog').close());
$('cancelFormBtn').addEventListener('click',()=>$('formDialog').close());
$('closeHistory').addEventListener('click',()=>$('historyDialog').close());
$('search').addEventListener('input',render);
(async()=>{try{const d=await api('/workspace');showWorkspace(d);await refresh();}catch(err){dashboardError(err);}})();
