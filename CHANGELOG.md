# What's improved in v2.0

**Built from your original ZIP:** no change to existing patient/doctor/appointment/consultation IDs or fictional demonstration record values.

## Fixed
- Closed the previously public CRUD API behind login and role authorization.
- Added input validation, session cookies, CSRF checks, password hashing and audit logs.
- Blocked consultations for cancelled/no-show appointments and enforced check-in/in-progress workflow.
- Blocked reassignment of an appointment after clinical or billing records exist.
- Prevented appointment-slot conflicts; database also defines a partial unique index on active/completed doctor slots.
- Restricted clinical orders and lab-result updates by staff role.
- Strengthened deletion protection for linked documents.
- Updated seed to preserve existing records and guard destructive resets.
- Added invoice balance validation and payment-status calculation.

## Added
- Modern role-aware interface with overview dashboard and dedicated tabs.
- Triage/vital signs, pharmacy prescriptions/dispensing, lab requests/results, invoices/payments, staff administration, audit trail.
- First-admin setup, Windows launcher scripts, consistency audit, automated unit tests, and acceptance-test instructions.
- First class use of Uganda/EAT times for appointment entry and display.

## Not implemented / not claimed
- Verified production security; penetration test; healthcare regulatory compliance.
- Clinical decision support, drug-interaction checks, medical coding (ICD/SNOMED), interoperability (FHIR), consent and legal retention policies.
- Offline synchronization, cloud deployment, backup scheduling, failover and production observability.
- MongoDB multi-document transactional payments on a standalone local MongoDB instance.
- Real-server integration tests (not possible in the current environment).

The app is a **coursework/demo system**, not a hospital-grade certified EHR.
