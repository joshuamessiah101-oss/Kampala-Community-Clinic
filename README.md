# Kampala Community Clinic — upgraded MongoDB system (v2.0)

A complete **academic outpatient-clinic workflow prototype** built from the original `health-clinic-mongodb.zip`. It retains the four original collections and user-facing CRUD features, and adds staff login, role-based access control, structured workflow validation, laboratory work, pharmacy, billing, dashboards and audit events. **All supplied sample patient data is fictional. This prototype is not validated for live patient care.**

## 1. Windows startup — use this exact order

Requirements: Node.js 18+ (`node -v`), MongoDB Community Server (`mongod` running on localhost:27017), and a modern browser.

In **CMD** or PowerShell, navigate to the extracted folder containing `package.json`:

```bat
cd C:\path\to\health-clinic-mongodb
npm install
npm run setup:admin
npm run seed
npm start
```

1. `npm run setup:admin` asks for an administrator username and hidden password (12+ characters). Run it **once**. Keep the password private.
2. `npm run seed` adds any missing **fictional demonstration records**, but never overwrites existing data. It keeps your original patients, doctors, appointments and consultations.
3. `npm start` launches **http://localhost:3000**. The server binds to `127.0.0.1` by default.
4. Sign in using the administrator account. Use **Staff access** to add accounts for specific staff roles.

To check quality without MongoDB running:

```bat
npm run check
npm test
npm run audit:data  # requires MongoDB running; read-only consistency report
```

In PowerShell, if MongoDB uses another connection:

```powershell
$env:MONGO_URI = 'mongodb://127.0.0.1:27017'
$env:DB_NAME = 'health_clinic_db'
npm start
```

The `.env.example` file documents the values, but **it is not automatically loaded**. Assign environment variables explicitly in your shell or deployment configuration.

## 2. Existing data and migration safety

**Important:** Back up your MongoDB database before running the upgraded server. MongoDB schema creation and indexes run automatically at startup. Existing documents are retained, but installing unique indexes may fail if the database already contains conflicting appointment time slots or duplicate consultation/triage relationships.

From a terminal with MongoDB Database Tools installed:

```bat
mongodump --uri="mongodb://127.0.0.1:27017" --db=health_clinic_db --out=clinic_backup
```

Backups may contain sensitive information. Protect them appropriately. The upgrade does **not** automatically purge your existing records, run the old destructive reset, or silently rewrite existing appointments.

The original four collections remain: `patients`, `doctors`, `appointments`, `consultations`. New collections are `triage`, `prescriptions`, `lab_requests`, `lab_results`, `invoices`, `payments`, `users`, `sessions`, `audit_logs`.

## 3. How clinic tasks work

1. **Reception:** Register/find a patient, book a `Scheduled` appointment. Check the patient in to set status `Checked-in`.
2. **Nurse:** Add triage notes and vital signs, referencing the checked-in appointment.
3. **Clinician:** Advance the visit to `In-progress`, then record a consultation, order tests and write prescriptions. Finish by marking `Completed`.
4. **Laboratory:** Find lab requests, add verified results, and mark requests `Completed` after a result exists.
5. **Pharmacy:** View clinician prescriptions; **Dispense** changes an order from `Prescribed` to `Dispensed`.
6. **Cashier:** Create an invoice for an appointment and record payments (UGX). An overpayment is rejected. Invoice status is `Unpaid`, `Part-paid` or `Paid`.
7. **Admin:** Manage staff accounts, inspect audit events and protect deletes; staff accounts use specific access roles.

New appointments must start as `Scheduled`. A transition from `Scheduled` directly to `Completed` is rejected. Once consultations or billing exist, patient and doctor references on the appointment cannot be reassigned. A cancelled/no-show appointment cannot receive a consultation.

## 4. Role permissions

| Role | Relevant modules / permitted actions |
|---|---|
| Admin | Patients, doctors, appointments, staff users, audit trail, billing administration; read-only clinical access where specified |
| Reception | Patients, appointments, patient lookup |
| Nurse | Read patients/appointments/consultations, write triage, check-in appointments |
| Clinician | Consultations, prescriptions, lab orders, triage, appointments |
| Lab | Update test status and add lab results; cannot alter clinician-authored test names |
| Pharmacy | View prescriptions; special dispense action; cannot create prescriptions |
| Cashier | Read patient/appointment references; issue invoices and enter payments; no consultation notes |

Security: salted scrypt password hashes, hashed session tokens in MongoDB, HttpOnly SameSite Strict cookies, CSRF protection on state-changing authenticated requests, permission checks on the API (not just UI), limited login attempts, and audit events without copying medical notes into logs.

To add a staff account: **Staff access → Add staff user**. Set username, strong password, role and enabled status. Logout and login with that account to see the restricted tabs.

## 5. MongoDB schema and data choices

- Original patient `_id` values such as `P001` remain strings and continue to be accepted.
- New IDs are generated with prefixes such as `T`, `RX`, `LR`, `LS`, `I`, and `PM`.
- All clinical orders reference an existing appointment, with patient identity derived server-side.
- Triage uses embedded `vitals`; consultations use symptoms arrays and an embedded vital-sign object.
- Medication dose, diagnosis, and lab results are **entered by authorized staff**. The software does not suggest treatment or automatically interpret results.
- `patients.phone`, `emergency_contact` and `allergies` are optional to avoid breaking old patient records.
- Monetary amounts are **whole-number Ugandan shillings** in this prototype.
- MongoDB `appointments.scheduled_at` uses BSON dates; the interface displays East Africa Time (UTC+3).

## 6. API examples

The browser uses `/api/auth/login`, `/api/auth/me`, `/api/auth/logout` and role-protected routes such as:

- `GET /api/patients`, `POST /api/patients`, `PUT /api/patients/P001`
- `GET /api/patients/P001/history`
- `GET /api/appointments`, `POST /api/appointments`, `PUT /api/appointments/A011`
- `GET /api/triage`, `/api/consultations`, `/api/prescriptions`, `/api/lab_requests`, `/api/lab_results`
- `PATCH /api/prescriptions/RX001/dispense` (pharmacy role)
- `GET /api/invoices`, `/api/payments`, `/api/audit_logs`
- `GET /api/summary`

Login sets a session cookie, and `/api/auth/me` returns a CSRF token that the web interface submits in `X-CSRF-Token` for writes. The API rejects unauthorized requests.

## 7. Seed and reset protection

`npm run seed` is **non-destructive**: it uses `$setOnInsert` and skips existing records. It inserts 40 original sample records and a few additional fictional workflow records (triage, lab order, invoice/payment) only when those IDs are absent.

Do not run reset on real data. `npm run seed:reset` will be **refused** unless both `DB_NAME` ends in `_demo` and `CLINIC_ALLOW_DEMO_RESET=YES`. Even then, administrator accounts are retained.

## 8. Important limitations before production use

This upgraded system has not been independently security-audited or clinically validated. It lacks interoperability testing, comprehensive clinical coding, regulatory sign-off, immutable clinical amendments, consent/retention policies, automated backups and disaster recovery verification. Audit writes are best-effort and MongoDB standalone deployments do not support multi-document transactions; for **financial and cross-collection atomicity**, use a MongoDB replica set and proper transactions. The application intentionally defaults to localhost and is **not approved for patient data**.

For coursework demonstration, run `npm test`, `npm start`, then sign in and demonstrate patient registration → appointment → check-in → triage → consultation → laboratory/pharmacy → billing. Repeat checks as each role.

**Scheduling note:** The prototype treats appointments as 30-minute blocks. Requests for the same doctor less than 30 minutes apart are rejected; future versions could support variable durations and staff shift calendars.
