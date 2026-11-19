'use strict';
/**
 * Kampala Community Clinic v2 — local, interactive administrator password reset.
 * Place in the health-clinic-mongodb project directory and run:
 *   node reset-admin-password.js
 *
 * Does not delete any medical records or other user accounts.
 * Requires a local interactive terminal and access to the configured MongoDB DB.
 */
const readline = require('node:readline');
const { connect } = require('./db');
const { hashPassword } = require('./security');

const ADMIN_USERNAME = 'clinicadmin';

function readHidden(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    return Promise.reject(new Error('Please run this script in an interactive Windows CMD or PowerShell terminal.'));
  }
  process.stdout.write(prompt);
  process.stdin.resume();
  process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    const cleanup = () => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    };
    const onData = chunk => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') { cleanup(); resolve(value); return; }
        if (ch === '\u0003') { cleanup(); reject(new Error('Cancelled. No changes made.')); return; }
        if (ch === '\b' || ch === '\u007f') { value = value.slice(0, -1); continue; }
        if (ch.charCodeAt(0) >= 32) value += ch;
      }
    };
    process.stdin.on('data', onData);
  });
}

async function main() {
  let client;
  try {
    console.log('Kampala Community Clinic — Administrator Password Reset');
    console.log(`Account: ${ADMIN_USERNAME}`);
    console.log('Typed password characters will not appear on the screen.');
    // Validate credentials before touching the database.
    const password = await readHidden('New password (12–128 characters, hidden): ');
    // Validate locally before asking again; never display the password.
    if (password.length < 12 || password.length > 128) {
      throw new Error('Password must contain 12–128 characters. No changes made.');
    }
    const confirm = await readHidden('Confirm new password (hidden): ');
    if (password !== confirm) throw new Error('Passwords do not match. No changes made.');
    const password_hash = hashPassword(password);

    const conn = await connect();
    client = conn.client;
    const db = conn.db;
    const admin = await db.collection('users').findOne({ username: ADMIN_USERNAME, role: 'admin' });
    if (!admin) throw new Error(`The administrator '${ADMIN_USERNAME}' was not found. No changes made.`);

    const result = await db.collection('users').updateOne(
      { _id: admin._id, username: ADMIN_USERNAME, role: 'admin' },
      { $set: { password_hash } }
    );
    if (result.matchedCount !== 1) throw new Error('Admin record changed during reset. Please retry.');

    // Log and invalidate sessions, without confusing a successful password reset with
    // a secondary logging issue.
    try { await db.collection('sessions').deleteMany({ username: ADMIN_USERNAME }); }
    catch (e) { console.warn('Warning: Old login sessions could not be cleared:', e.message); }
    try {
      await db.collection('audit_logs').insertOne({
        actor: 'local-administrator',
        action: 'PASSWORD_RESET',
        collection: 'users',
        record_id: String(admin._id),
        at: new Date(),
        changed_fields: ['password_hash']
      });
    } catch (e) { console.warn('Warning: Reset audit could not be saved:', e.message); }
    console.log(`SUCCESS: Password updated for '${ADMIN_USERNAME}'.`);
    console.log('Patient, appointment, doctor, consultation, billing and other clinic records were not changed.');
    console.log('You may now log in with your new password.');
  } catch (err) {
    console.error(`Password reset failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    if (client) await client.close();
  }
}

main();
