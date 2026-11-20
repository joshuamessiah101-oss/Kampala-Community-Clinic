'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {text,optionalText,choice,num,date,symptoms,phone,appointmentStatusTransition,appointmentSlotsOverlap,can,ROLES,ACCESS}=require('../rules');
test('required text trims and validates',()=>{assert.equal(text('  Jamin  ','Name'),'Jamin');assert.throws(()=>text(' ','Name'),/required/);assert.throws(()=>text('abcdef','Name',3),/3/);});
test('optional text handles blanks without accidental undefined',()=>{assert.equal(optionalText(undefined,'Notes'),'');assert.equal(optionalText(' test ','Notes'),'test');});
test('choices reject arbitrary status',()=>{assert.equal(choice('Scheduled','Status',['Scheduled']),'Scheduled');assert.throws(()=>choice('Random','Status',['Scheduled']),/must be one of/);});
test('numeric validation rejects NaN and infinity',()=>{for(const x of [null,'',undefined,'invalid',Infinity])assert.throws(()=>num(x,'Amount',1,100));});
test('positive whole-number validation',()=>{assert.equal(num('180000','Amount',1,1000000,{integer:true}),180000);assert.throws(()=>num(22.3,'Amount',1,100,{integer:true}));});
test('optional number returns null',()=>assert.equal(num('','Temp',30,45,{optional:true}),null));
test('date parser requires a value',()=>{assert.ok(date('2026-11-18T07:00:00Z','Appointment') instanceof Date);assert.throws(()=>date('','Appointment'));});
test('symptoms accepts a list or comma separated text',()=>{assert.deepEqual(symptoms('Cough, Fever'),['Cough','Fever']);assert.throws(()=>symptoms(''),/required|at least|list|1 to 20/);});
test('Ugandan telephone format and flexible punctuation are allowed',()=>{assert.equal(phone('+256782123456'),'+256782123456');assert.equal(phone(''), '');assert.throws(()=>phone('abc'),/invalid/);});
test('status transition follows checked-in workflow',()=>{
 assert.ok(appointmentStatusTransition('Scheduled','Checked-in'));assert.ok(appointmentStatusTransition('Checked-in','In-progress'));
 assert.ok(appointmentStatusTransition('In-progress','Completed'));assert.ok(!appointmentStatusTransition('Cancelled','In-progress'));
 assert.ok(!appointmentStatusTransition('Scheduled','Completed'));assert.ok(!appointmentStatusTransition('Completed','Cancelled'));
});
test('only clinician writes consultations',()=>{assert.ok(can('clinician','consultations','write'));assert.equal(can('reception','consultations','write'),false);assert.equal(can('admin','consultations','write'),false);});
test('pharmacy cannot create a prescription',()=>{assert.ok(can('pharmacy','prescriptions','read'));assert.equal(can('pharmacy','prescriptions','write'),false);});
test('cashier cannot read consultation notes',()=>{assert.equal(can('cashier','consultations','read'),false);assert.ok(can('cashier','payments','write'));});
test('audit log is read-only for admins',()=>{assert.equal(can('admin','audit_logs','read'),true);assert.equal(can('admin','audit_logs','write'),false);});
test('all permissions use known roles',()=>{for(const item of Object.values(ACCESS))for(const roles of Object.values(item))for(const role of roles)assert.ok(ROLES.includes(role));});

test("30-minute appointment blocks detect overlaps",()=>{assert.ok(appointmentSlotsOverlap("2026-11-18T09:00:00Z","2026-11-18T09:15:00Z"));assert.equal(appointmentSlotsOverlap("2026-11-18T09:00:00Z","2026-11-18T09:30:00Z"),false);});
