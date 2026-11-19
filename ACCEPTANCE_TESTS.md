# Clinic Upgrade — Practical Acceptance Test Plan

**Use ONLY fictional demonstration data in your local test database.** All tests below need Node/npm dependencies installed, a running MongoDB server, and at least one account per relevant role. The automated unit tests do **not** replace these checks.

## Initial checks

- [ ] Back up the database using `mongodump`.
- [ ] `npm install` succeeds with the supported Node.js version.
- [ ] `npm run check` passes.
- [ ] `npm test` reports all tests passing.
- [ ] `npm run setup:admin` registers an administrator (once only).
- [ ] `npm run seed` adds missing fictional sample data without changing existing records.
- [ ] `npm start` starts at http://localhost:3000.
- [ ] `npm run audit:data` reports 0 issues.

## Login and role checks

- [ ] Not signed in: API read/write requests are rejected with 401.
- [ ] Correct admin credentials work; incorrect password fails.
- [ ] Repeated failed logins are temporarily rate-limited.
- [ ] Admin adds receptionist, nurse, clinician, lab, pharmacy and cashier users.
- [ ] Receptionist cannot edit clinician consultation records.
- [ ] Cashier cannot read consultation notes or write prescriptions.
- [ ] Pharmacy sees prescriptions and can dispense, but cannot create a prescription.
- [ ] User activation/deactivation takes effect on new requests.
- [ ] Logout invalidates the session; back button does not reopen protected API data.

## Patient and appointment checks

- [ ] Register a new fictional patient with Ugandan phone number and emergency contact.
- [ ] Search existing patient; open their visit history.
- [ ] Register/modify a doctor (admin only).
- [ ] Book a future appointment (status must start `Scheduled`).
- [ ] Try booking the same doctor and exact time for another patient: it is rejected.
- [ ] Change status to `Checked-in`, then `In-progress`, then `Completed`.
- [ ] Attempt direct `Scheduled` to `Completed`: rejected.
- [ ] Attempt to create a consultation for `Cancelled` appointment: rejected.
- [ ] Attempt reassignment of appointment with a consultation: rejected.

## Clinical tasks

- [ ] Nurse records at least one vital sign on a checked-in appointment.
- [ ] Unreasonable vital-sign values are rejected.
- [ ] Clinician records consultation and structured assessment on an active/completed appointment.
- [ ] Duplicate consultation for the same appointment is rejected.
- [ ] Clinician issues a fictional prescription; pharmacy marks it dispensed.
- [ ] Dispensed prescription cannot be edited into a different order.
- [ ] Clinician orders a fictional laboratory test; lab records a result and marks request completed.
- [ ] Lab cannot modify the clinician's ordered test name.
- [ ] Laboratory request cannot be marked completed without result evidence.

## Finance and data integrity

- [ ] Cashier creates an example invoice and records a part payment.
- [ ] Invoice updates to `Part-paid` and then `Paid` after final payment.
- [ ] Overpayment is rejected.
- [ ] Invoice with payment cannot be edited to a new total.
- [ ] Admin sees audit events, but they do not contain clinical note contents.
- [ ] Delete a patient still referenced in appointments: rejected.
- [ ] A second `npm run seed` doesn't overwrite edited values.
- [ ] `npm run audit:data` reports consistency results correctly.

## Known limitations

- Payment+invoice updates span collections and require multi-document transactions on a replica set for production-grade atomicity.
- Tests with a real browser and MongoDB cannot be completed in the code-generation runtime; do them locally.
- Clinical audit, privacy, regulatory, availability and backup recovery need independent review before any real deployment.
