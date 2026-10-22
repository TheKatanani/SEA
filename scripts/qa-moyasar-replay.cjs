const assert = require('node:assert/strict');
const { createHmac, randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const { localTrainingEnv, PROJECT_ID, ORIGIN } = require('./local-training-env.cjs');
Object.assign(process.env, localTrainingEnv());
const [bookingId, paymentId] = process.argv.slice(2);
if (!/^[a-z0-9]{40}$/.test(bookingId || '') || !/^[a-z0-9-]{36}$/.test(paymentId || '') || !PROJECT_ID.startsWith('demo-')) throw new Error('Expected a local booking ID and sandbox payment UUID');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const app = initializeApp({ projectId: PROJECT_ID, credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
const db = getFirestore(app);
async function main() {
  const response = await fetch('https://api.moyasar.com/v1/payments/' + paymentId, { headers: { Authorization: 'Basic ' + Buffer.from(process.env.MOYASAR_SECRET_KEY + ':').toString('base64') }, signal: AbortSignal.timeout(15000), redirect: 'error' });
  assert.equal(response.status, 200); const payment = await response.json();
  assert.ok(process.env.MOYASAR_SECRET_KEY.startsWith('sk_test_'), 'Expected sk_test_ secret key');
  if (typeof payment.live === 'boolean') {
    assert.equal(payment.live, false, 'Provider live flag must not be true in test mode');
  }
  assert.equal(payment.status, 'paid'); assert.equal(payment.amount, 100); assert.equal(payment.currency, 'SAR'); assert.equal(payment.metadata.booking_id, bookingId);
  const booking = (await db.collection('bookings').doc(bookingId).get()).data(); assert.equal(booking.status, 'CONFIRMED');
  const expiry = Date.now() + 3600000;
  const token = expiry + '.' + createHmac('sha256', process.env.BOOKING_ACCESS_SECRET).update('access:' + bookingId + ':' + expiry).digest('hex');
  for (let i = 0; i < 2; i++) {
    const replay = await fetch(ORIGIN + '/api/bookings/' + bookingId, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentId }) }); assert.equal(replay.status, 200);
  }
  const event = { id: 'local-replay-' + randomUUID(), type: 'payment_paid', secret_token: process.env.MOYASAR_WEBHOOK_SECRET, live: false, data: { id: paymentId } };
  for (let i = 0; i < 2; i++) {
    const replay = await fetch(ORIGIN + '/api/webhooks/moyasar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) }); assert.equal(replay.status, 200);
  }
  const cohort = (await db.collection('cohorts').doc(booking.cohortId).get()).data(); assert.equal(cohort.confirmedSeats, 1); assert.equal(Object.keys(cohort.holds).length, 0);
  const settled = (await db.collection('payments').doc(paymentId).get()).data(); assert.equal(settled.status, 'paid'); assert.equal(settled.refundRequired, false);
  const result = { projectId: PROJECT_ID, providerMode: 'test', providerPaymentVerified: true, amountMinor: 100, currency: 'SAR', browser3DS: 'successful', bookingState: 'CONFIRMED', confirmedSeatsAfterTwoCallbackReplaysAndTwoManualWebhookDeliveries: 1, realProviderWebhookDelivery: 'not tested — local-only environment', refundTest: 'not performed' };
  if (process.env.SEA_QA_REPORT_FILE) await fs.writeFile(process.env.SEA_QA_REPORT_FILE, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error('Sandbox replay QA: ' + error.name + ': ' + String(error.message).slice(0, 300)); process.exitCode = 1; }).finally(async () => { await db.terminate(); await app.delete(); });
