const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { localTrainingEnv, PROJECT_ID, ORIGIN } = require('./local-training-env.cjs');
Object.assign(process.env, localTrainingEnv());
if (!PROJECT_ID.startsWith('demo-') || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18080' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:19099') throw new Error('Local emulator safety check failed');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const app = initializeApp({ projectId: PROJECT_ID, credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) }, 'local-qa');
const db = getFirestore(app); const auth = getAuth(app);
const results = []; let ownerToken; let admissionsToken;
const attendee = { fullName: 'Synthetic Local Learner', email: 'learner@example.invalid', nationalId: '1000000000', mobile: '+966500000000' };
async function request(route, { method = 'GET', data, token, ip } = {}) {
  const response = await fetch(ORIGIN + route, { method, headers: { Origin: ORIGIN, ...(data ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(ip ? { 'x-forwarded-for': ip } : {}) }, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(90000) });
  const type = response.headers.get('content-type') || '';
  const body = type.includes('application/json') ? await response.json() : await response.text();
  return { status: response.status, body, headers: response.headers };
}
async function check(name, run) {
  try { await run(); results.push({ name, passed: true }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, passed: false, error: String(error.message).slice(0, 400) }); console.log('FAIL ' + name + ': ' + String(error.message).slice(0, 400)); }
}
function cohort(id, capacity = 1) {
  return { id, programCollection: 'courses', programId: 'local-sandbox-course', cohortCode: 'LOCAL-' + id.toUpperCase(), titleAr: 'اختبار محلي فقط — حجز تجريبي', titleEn: 'LOCAL TEST ONLY — Sandbox cohort', priceMinor: 100, currency: 'SAR', startAt: new Date(Date.now() + 30 * 86400000).toISOString(), endAt: new Date(Date.now() + 31 * 86400000).toISOString(), timeZone: 'Asia/Riyadh', scheduleAr: 'جلسة اختبار فقط', scheduleEn: 'Test session only', locationType: 'remote', venueAr: 'محلي — بيانات وهمية', venueEn: 'Local emulator — synthetic data', capacity, registrationOpen: true, status: 'published' };
}
function reserve(cohortId, requestKey = randomUUID(), ip = '192.0.2.1', extra = {}) {
  return request('/api/bookings', { method: 'POST', ip, data: { cohortId, requestKey, attendee, locale: 'en', privacyConsent: true, ...extra } });
}
async function save(value, token = ownerToken) { return request('/api/admin/training', { method: 'POST', token, data: { ...value, translationReview: { reviewed: value.status === 'published' ? ['ar:title', 'en:title', 'ar:schedule', 'en:schedule', 'ar:venue', 'en:venue'] : [] } } }); }
async function signIn(email) {
  const response = await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-demo-api-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Local-test-only-2026!', returnSecureToken: true }) });
  assert.equal(response.status, 200, 'Emulator sign in failed'); return (await response.json()).idToken;
}
async function seed() {
  for (const [uid, email, role] of [['local-qa-owner', 'local-owner@example.invalid', 'admin'], ['local-qa-admissions', 'local-admissions@example.invalid', 'admissions']]) {
    try { await auth.createUser({ uid, email, password: 'Local-test-only-2026!' }); } catch (error) { if (error.code !== 'auth/uid-already-exists' && error.code !== 'auth/email-already-exists') throw error; }
    await db.collection('admins').doc(uid).set({ active: true, role, email });
  }
  await db.collection('courses').doc('local-sandbox-course').set({ status: 'published', slug: 'local-sandbox-course', href: '/courses/local-sandbox-course', locales: { ar: { title: 'دورة اختبار محلية فقط', description: 'هذه بيانات اختبار وهمية وليست برنامجاً متاحاً للبيع.' }, en: { title: 'LOCAL TEST ONLY — Sandbox Course', description: 'Synthetic test data. This is not a real course for sale.' } } });
  await db.collection('brand').doc('main').set({ status: 'published', locales: { ar: { name: 'SEA — اختبار محلي' }, en: { name: 'SEA — LOCAL TEST' } } });
  await db.collection('policies').doc('privacy').set({ status: 'published', slug: 'privacy', href: '/policies/privacy', locales: { en: { title: 'LOCAL TEST POLICY', body: 'Synthetic local testing only. No real learner data.' }, ar: { title: 'سياسة اختبار محلية', body: 'اختبار محلي ببيانات وهمية فقط.' } } });
  await db.collection('pages').doc('programs').set({ status: 'published', locales: { ar: { title: 'برامج تجريبية محلية' }, en: { title: 'Local sandbox programs' } } });
  await db.collection('forms').doc('application_interest').set({ status: 'published', locales: Object.fromEntries(['ar', 'en'].map(locale => [locale, { title: locale === 'ar' ? 'اهتمام تجريبي فقط' : 'Test interest form', fields: [{ name: 'fullName', label: locale === 'ar' ? 'الاسم الوهمي' : 'Fictional name', type: 'text', required: true }, { name: 'email', label: locale === 'ar' ? 'البريد الوهمي' : 'Fictional email', type: 'email', required: true }] }])) });
  ownerToken = await signIn('local-owner@example.invalid'); admissionsToken = await signIn('local-admissions@example.invalid');
}
async function main() {
  if (process.argv.includes('--reset')) {
    const reset = await fetch('http://127.0.0.1:18080/emulator/v1/projects/' + PROJECT_ID + '/databases/(default)/documents', { method: 'DELETE' });
    assert.equal(reset.status, 200, 'Local emulator reset failed');
    console.log('Reset disposable demo emulator data only: ' + PROJECT_ID);
  }
  await seed();
  if (process.argv.includes('--seed-only')) {
    for (const id of ['qa-ui-success', 'qa-ui-decline', 'qa-ui-arabic']) { const result = await save(cohort(id)); assert.equal(result.status, 200, 'Failed to create UI fixture'); }
    console.log('Seeded local UI fixtures only. No cloud data was used.'); return;
  }
  const definitions = Object.fromEntries(['qa-race', 'qa-expiry', 'qa-cancel', 'qa-closed', 'qa-consent', 'qa-limit'].map(id => [id, cohort(id, id === 'qa-limit' ? 10 : 1)]));
  await check('Owner can create published test cohorts through authenticated API', async () => { for (const value of Object.values(definitions)) { const r = await save(value); assert.equal(r.status, 200); } });
  await check('Firestore emulator connection and demo-only project are active', async () => { assert.equal(db.projectId, PROJECT_ID); const r = await request('/api/health/firebase'); assert.equal(r.status, 200); assert.equal(r.body.status, 'firestore-ok'); });
  await check('Sandbox interest form preflight and synthetic submission both work', async () => {
    const preflight = await request('/api/applications'); assert.equal(preflight.status, 200); assert.deepEqual(preflight.body, { enabled: true, demo: true });
    const saved = await request('/api/applications', { method: 'POST', data: { formType: 'application_interest', locale: 'en', fields: { fullName: 'Synthetic Interest Learner', email: 'interest@example.invalid' }, privacyConsent: true } }); assert.equal(saved.status, 201);
    const rows = await db.collection('applications').where('fields.email', '==', 'interest@example.invalid').get(); assert.ok(rows.size > 0); assert.equal(rows.docs[0].data().privacyPolicyVersion, 'local-synthetic-test-only');
  });
  await check('Unauthenticated training access is denied', async () => { assert.equal((await request('/api/admin/training')).status, 401); });
  await check('Admissions role cannot create or export financial bookings', async () => { assert.equal((await save(cohort('qa-forbidden'), admissionsToken)).status, 403); assert.equal((await request('/api/admin/training/export', { token: admissionsToken })).status, 403); });
  await check('Public API does not expose financial collections', async () => { const r = await request('/api/site/content?collection=bookings'); assert.equal(r.status, 404); });
  await check('Missing consent and invented quantity are rejected', async () => { assert.equal((await reserve('qa-consent', randomUUID(), '192.0.2.2', { privacyConsent: false })).status, 400); assert.equal((await reserve('qa-consent', randomUUID(), '192.0.2.2', { quantity: 2 })).status, 400); });
  let winner; let raceKeys;
  await check('20 concurrent HTTP reservations allocate exactly one final seat in Firestore', async () => {
    raceKeys = Array.from({ length: 20 }, () => randomUUID());
    const responses = await Promise.all(raceKeys.map((key, i) => reserve('qa-race', key, '192.0.2.' + (20 + i))));
    const index = responses.findIndex(r => r.status === 201); winner = { ...responses[index]?.body, requestKey: raceKeys[index], ip: '192.0.2.' + (20 + index) };
    assert.equal(responses.filter(r => r.status === 201).length, 1);
    assert.deepEqual([...new Set(responses.filter(r => r.status !== 201).map(r => r.status))], [409]);
    const saved = (await db.collection('cohorts').doc('qa-race').get()).data(); assert.equal(Object.keys(saved.holds).length, 1); assert.equal(saved.confirmedSeats, 0);
  });
  await check('Request retry returns the same booking without taking another seat', async () => { assert.ok(winner?.id); const r = await reserve('qa-race', winner.requestKey, winner.ip); assert.equal(r.status, 201); assert.equal(r.body.id, winner.id); });
  await check('Public availability automatically shows sold out during the active hold', async () => { const r = await request('/api/cohorts?collection=courses&programId=local-sandbox-course'); assert.equal(r.status, 200); const c = r.body.items.find(c => c.id === 'qa-race'); assert.equal(c.remaining, 0); assert.equal(c.open, false); assert.equal('holds' in c, false); });
  await check('Receipt requires the signed booking capability', async () => { assert.equal((await request('/api/bookings/' + winner.id)).status, 403); const r = await request('/api/bookings/' + winner.id, { token: winner.accessToken }); assert.equal(r.status, 200); assert.equal(r.body.booking.status, 'PENDING'); assert.equal(r.headers.get('cache-control'), 'private, no-store'); });
  await check('Expiry releases the seat without relying on the scheduler', async () => {
    const first = await reserve('qa-expiry', randomUUID(), '192.0.2.70'); assert.equal(first.status, 201);
    const expired = Date.now() - 1000;
    await db.collection('bookings').doc(first.body.id).update({ holdExpiresAt: expired }); await db.collection('cohorts').doc('qa-expiry').update({ holds: { [first.body.id]: expired } });
    const next = await reserve('qa-expiry', randomUUID(), '192.0.2.71'); assert.equal(next.status, 201);
    const previous = await request('/api/bookings/' + first.body.id, { token: first.body.accessToken }); assert.equal(previous.body.booking.status, 'EXPIRED');
    const current = await request('/api/bookings/' + next.body.id, { token: next.body.accessToken }); assert.equal(current.body.booking.status, 'PENDING');
  });
  await check('Pending booking cancellation frees the seat', async () => {
    const r = await reserve('qa-cancel', randomUUID(), '192.0.2.72'); assert.equal(r.status, 201);
    const cancel = await request('/api/admin/training/bookings', { method: 'POST', token: ownerToken, data: { action: 'cancel', bookingId: r.body.id } }); assert.equal(cancel.status, 200);
    const next = await reserve('qa-cancel', randomUUID(), '192.0.2.73'); assert.equal(next.status, 201);
  });
  await check('Closing registration preserves an existing hold and prevents new reservations', async () => {
    const r = await reserve('qa-closed', randomUUID(), '192.0.2.74'); assert.equal(r.status, 201);
    const closed = await save({ ...definitions['qa-closed'], registrationOpen: false }); assert.equal(closed.status, 200);
    assert.equal((await reserve('qa-closed', randomUUID(), '192.0.2.75')).status, 409);
    const receipt = await request('/api/bookings/' + r.body.id, { token: r.body.accessToken }); assert.equal(receipt.body.booking.status, 'PENDING');
  });
  await check('Cohort code uniqueness is enforced by the Firestore transaction', async () => { const r = await save({ ...cohort('qa-duplicate-code'), cohortCode: definitions['qa-race'].cohortCode }); assert.equal(r.status, 409); });
  await check('Rate limiting rejects the seventh reservation from one synthetic address', async () => { for (let i = 0; i < 6; i++) assert.equal((await reserve('qa-limit', randomUUID(), '192.0.2.100')).status, 201); assert.equal((await reserve('qa-limit', randomUUID(), '192.0.2.100')).status, 429); });
  await check('Owner can query, search and export local bookings', async () => { const r = await request('/api/admin/training?collection=bookings&q=synthetic', { token: ownerToken }); assert.equal(r.status, 200); assert.ok(r.body.items.length > 0); const csv = await request('/api/admin/training/export?collection=bookings&cohortId=qa-race&format=csv', { token: ownerToken }); assert.equal(csv.status, 200); assert.ok(csv.body.includes('Synthetic Local Learner')); });
  await check('Scheduler and webhook reject missing credentials', async () => { assert.equal((await request('/api/jobs/training', { method: 'POST', data: {} })).status, 401); const r = await request('/api/webhooks/moyasar', { method: 'POST', data: { id: 'local-event', type: 'payment_paid', live: false, secret_token: 'wrong-secret', data: { id: 'local-payment' } } }); assert.equal(r.status, 401); });
  await check('Current role removal overrides an already-issued emulator ID token', async () => { await db.collection('admins').doc('local-qa-admissions').update({ active: false }); assert.equal((await request('/api/admin/data?collection=applications', { token: admissionsToken })).status, 403); });
  const summary = { projectId: PROJECT_ID, database: 'local Firestore emulator', providerMode: 'test', total: results.length, passed: results.filter(r => r.passed).length, results };
  if (process.env.SEA_QA_REPORT_FILE) await fs.writeFile(process.env.SEA_QA_REPORT_FILE, JSON.stringify(summary, null, 2));
  console.log('Emulator checks: ' + summary.passed + '/' + summary.total + ' passed. No live Firebase writes.');
  if (summary.passed !== summary.total) process.exitCode = 1;
}
main().catch(error => { console.error('Local emulator QA stopped: ' + error.name + ': ' + String(error.message).slice(0, 400)); process.exitCode = 1; }).finally(async () => { await db.terminate(); await app.delete(); });
