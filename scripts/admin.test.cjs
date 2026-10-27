const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
let rows, queue, providerCalls, providerMode = 'ok', fastTimeout = false;
const db = {
  collection(name) {
    const query = (filters = [], cap = 1000) => ({
      doc(id = 'generated-' + rows.size) { const key = name + '/' + id; return { id, key, get: async () => snapshot(key) }; },
      where(key, op, value) { return query([...filters, [key, value]], cap); }, orderBy() { return this; }, limit(n) { return query(filters, n); },
      async get() { const docs = [...rows.keys()].filter(k => k.startsWith(name + '/') && filters.every(([field, value]) => rows.get(k)[field] === value)).slice(0, cap).map(snapshot); return { docs, size: docs.length }; },
      count() { return { get: async () => { const result = await this.get(); return { data: () => ({ count: result.size }) }; } }; },
    });
    return query();
  },
  getAll(...refs) { return Promise.all(refs.map(r => r.get())); },
  runTransaction(callback) { const operation = queue.then(async () => { const writes = []; let writing = false; const tx = { get: async ref => { assert.equal(writing, false, 'Reads must precede writes'); return snapshot(ref.key); }, set: (ref, value, options) => { writing = true; writes.push(() => rows.set(ref.key, options?.merge ? { ...rows.get(ref.key), ...structuredClone(value) } : structuredClone(value))); }, create: (ref, value) => { writing = true; writes.push(() => { assert.equal(rows.has(ref.key), false); rows.set(ref.key, structuredClone(value)); }); }, delete: ref => { writing = true; writes.push(() => rows.delete(ref.key)); } }; const result = await callback(tx); writes.forEach(write => write()); return result; }); queue = operation.catch(() => {}); return operation; },
};
function snapshot(key) { const value = rows.get(key); return { id: key.split('/')[1], exists: value !== undefined, data: () => value === undefined ? undefined : structuredClone(value) }; }
const modules = new Map();
function load(relative) {
  let filename = path.resolve(root, relative); if (!fs.existsSync(filename)) filename += fs.existsSync(filename + '.ts') ? '.ts' : '.tsx';
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} }; modules.set(filename, module); const requireAt = createRequire(filename);
  const localRequire = name => {
    if (name === 'server-only') return {};
    if (name === '@/lib/firebase/admin' || name === './admin' && filename.includes('authorization')) return { getAdminDb: () => db, isFirebaseAdminConfigured: () => true, getAdminAuth: async () => ({ verifyIdToken: async token => { if (token === 'invalid') throw new Error('Invalid token'); return { uid: token }; } }) };
    if (name === 'firebase-admin/firestore') return { FieldValue: { serverTimestamp: () => Date.now() } };
    if (name === 'next/cache') return { revalidatePath() {} };
    if (name === '@google/genai') return { ThinkingLevel: { LOW: 'low' }, GoogleGenAI: class { constructor(options) { this.models = { generateContent: async input => { providerCalls.push({ options, input }); if (providerMode === 'never') return new Promise(() => {}); if (providerMode === 'invalid') return { text: '{"fields":[{"key":"priceMinor","text":"100"}]}' }; const content = JSON.parse(input.contents); return { text: JSON.stringify({ fields: content.fields.map(f => ({ key: f.key, text: f.text || content.instruction })) }) }; } }; } } };
    if (name.startsWith('@/')) return load(name.slice(2));
    if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), name)));
    return requireAt(name);
  };
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', compiled)(localRequire, module, module.exports, (fn, delay) => setTimeout(fn, fastTimeout && delay === 20000 ? 5 : delay), clearTimeout);
  return module.exports;
}
function reset() { rows = new Map(); queue = Promise.resolve(); providerCalls = []; providerMode = 'ok'; fastTimeout = false; process.env.FIREBASE_OWNER_UID = 'owner'; delete process.env.GEMINI_API_KEY; for (const role of ['editor', 'admissions', 'media', 'admin']) rows.set('admins/' + role, { role, active: true }); }
reset();
const content = load('lib/admin/content.ts'), ai = load('lib/admin/ai.ts'), aiRoute = load('app/api/admin/ai/route.ts'), session = load('app/api/admin/session/route.ts'), admin = load('app/api/admin/data/route.ts'), layout = load('lib/public-layout.ts');
const input = (text = 'Course 25') => ({ collection: 'courses', action: 'translate', sourceLocale: 'en', targetLocale: 'ar', fields: [{ key: 'title', text }] });
const request = (route, body, token = 'owner') => ({ nextUrl: new URL('http://localhost' + route), headers: new Headers(token ? { Authorization: 'Bearer ' + token, Origin: 'http://localhost' } : {}), json: async () => body, text: async () => JSON.stringify(body) });
test('session hides financial and configuration areas from content and admissions staff', async () => { reset(); const editor = await (await session.GET(request('/api/admin/session', null, 'editor'))).json(); assert.ok(editor.resources.includes('courses')); assert.ok(!editor.resources.includes('payments')); assert.ok(!editor.resources.includes('team')); assert.equal(editor.aiAvailable, false); const admissions = await (await session.GET(request('/api/admin/session', null, 'admissions'))).json(); assert.deepEqual(admissions.areas, ['overview', 'inbox']); assert.equal((await session.GET(request('/api/admin/session', null, ''))).status, 401); });
test('AI requires authentication, collection access and a server key', async () => { reset(); assert.equal((await aiRoute.POST(request('/api/admin/ai', input(), ''))).status, 401); assert.equal((await aiRoute.POST(request('/api/admin/ai', input(), 'media'))).status, 403); assert.equal((await aiRoute.POST(request('/api/admin/ai', input(), 'editor'))).status, 503); assert.equal(providerCalls.length, 0); });
test('AI rejects private, financial, structural and publication fields before provider calls', async () => { reset(); process.env.GEMINI_API_KEY = 'server-test-only'; for (const key of ['priceMinor', 'capacity', 'status', 'id', 'fields.0.name', 'sections.0.buttonUrl', '__proto__.title', 'contact.email']) { const body = { ...input(), fields: [{ key, text: 'Private value' }] }; assert.equal((await aiRoute.POST(request('/api/admin/ai', body))).status, 400, key); } assert.equal((await aiRoute.POST(request('/api/admin/ai', { ...input(), collection: 'applications' }))).status, 400); assert.equal(providerCalls.length, 0); });
test('writing and translation validate batch size, direction, policy restrictions and briefs', () => { for (const value of [{ ...input(), fields: Array.from({ length: 21 }, (_, i) => ({ key: 'title' + i, text: 'text' })) }, { ...input(), targetLocale: 'en' }, { ...input(), fields: [{ key: 'title', text: 'x'.repeat(12001) }] }, { ...input(), action: 'draft' }, { ...input(), action: 'shorten', collection: 'policies' }]) assert.equal(ai.aiRequestSchema.safeParse(value).success, false); assert.equal(ai.aiRequestSchema.safeParse({ ...input(), collection: 'policies', action: 'improve', targetLocale: 'en' }).success, true); });
test('Arabic/English suggestions preserve numbers and reject altered facts or extra fields', () => { const body = input('Course 25 https://example.com/info'); assert.throws(() => ai.validateSuggestions(body, { fields: [{ key: 'title', text: 'Course 100' }] })); assert.throws(() => ai.validateSuggestions(body, { fields: [{ key: 'priceMinor', text: '25' }] })); assert.throws(() => ai.validateSuggestions(body, { fields: [{ key: 'title', text: 'Course 25 https://evil.example' }] })); const result = ai.validateSuggestions(body, { fields: [{ key: 'title', text: 'دورة ٢٥ https://example.com/info' }] }); assert.equal(result[0].sourceHash, content.textHash(body.fields[0].text)); });
test('provider output is schema checked and identical requests reuse cached suggestions', async () => { reset(); process.env.GEMINI_API_KEY = 'server-test-only'; const body = input('Cache example 25'); const first = await ai.generateAssistance(body, 'cache-user'); const second = await ai.generateAssistance(body, 'cache-user'); assert.equal(first.cached, false); assert.equal(second.cached, true); assert.equal(providerCalls.length, 1); assert.equal(providerCalls[0].options.httpOptions.timeout, 20000); providerMode = 'invalid'; await assert.rejects(ai.generateAssistance(input('Invalid output 26'), 'invalid-output'), /AI_INVALID_OUTPUT/); });

test('translation and editing cannot silently remove source links or numeric facts', () => {
  for (const action of ['translate', 'improve', 'shorten']) {
    const body = { ...input('Course 25 https://example.com/info'), action };
    assert.throws(() => ai.validateSuggestions(body, { fields: [{ key: 'title', text: 'Course 25' }] }), /AI_FACTS_CHANGED/);
    assert.throws(() => ai.validateSuggestions(body, { fields: [{ key: 'title', text: 'Course https://example.com/info' }] }), /AI_FACTS_CHANGED/);
    assert.equal(ai.validateSuggestions(body, { fields: [{ key: 'title', text: 'دورة ٢٥ https://example.com/info.' }] }).length, 1);
  }
});
test('provider timeout leaves manual content untouched', async () => { reset(); process.env.GEMINI_API_KEY = 'server-test-only'; providerMode = 'never'; fastTimeout = true; const record = { locales: { en: { title: 'Unchanged' }, ar: { title: 'يدوي' } } }; await assert.rejects(ai.generateAssistance(input('Timeout 27'), 'timeout-user'), /AI_TIMEOUT/); assert.equal(record.locales.ar.title, 'يدوي'); fastTimeout = false; });

test('delayed suggestions cannot apply to a newer source, and long pages split into bounded batches', () => {
  const { suggestionIsCurrent, assistanceBatch } = load('lib/admin/assistance.ts');
  const pairs = Array.from({ length: 25 }, (_, i) => ({ key: 'sections.' + i + '.body', label: '', source: 'Source ' + i, target: '' }));
  const suggestion = { key: pairs[0].key, sourceText: pairs[0].source, sourceHash: content.textHash(pairs[0].source), text: 'اقتراح' };
  assert.equal(suggestionIsCurrent(suggestion, pairs), true);
  assert.equal(suggestionIsCurrent(suggestion, [{ ...pairs[0], source: 'New source' }]), false);
  const first = assistanceBatch(pairs, pairs.map(p => p.key), 'translate');
  const remaining = assistanceBatch(pairs, pairs.filter(p => !first.some(f => f.key === p.key)).map(p => p.key), 'translate');
  assert.equal(first.length, 20); assert.equal(remaining.length, 5);
  assert.equal(assistanceBatch([{ ...pairs[0], source: '' }], [pairs[0].key], 'draft', 'Use supplied facts').length, 1);
  assert.ok(assistanceBatch(pairs.map(p => ({ ...p, source: 'x'.repeat(4000) })), pairs.map(p => p.key), 'translate').length === 3);
});
test('transactional quotas allow only 30 user requests and enforce the shared daily cap', async () => { reset(); const results = await Promise.allSettled(Array.from({ length: 31 }, () => ai.claimAiQuota('quota-user', Date.parse('2026-10-25T10:00:00Z')))); assert.equal(results.filter(r => r.status === 'fulfilled').length, 30); assert.equal(results.filter(r => r.status === 'rejected').length, 1); rows.set('ai_usage/site-2026-10-25', { count: 499 }); const site = await Promise.allSettled(['one', 'two'].map(uid => ai.claimAiQuota(uid, Date.parse('2026-10-25T11:00:00Z')))); assert.equal(site.filter(r => r.status === 'fulfilled').length, 1); });
test('accepting a suggestion preserves existing translations and form structure until explicitly applied', () => { const record = { priceMinor: 1500, status: 'draft', locales: { en: { title: 'Course', fields: [{ name: 'email', type: 'email', required: true, label: 'Email' }] }, ar: { title: 'ترجمة يدوية' } } }; assert.equal(record.locales.ar.title, 'ترجمة يدوية'); const next = content.applyText(record, 'forms', 'ar', 'fields.0.label', 'البريد الإلكتروني', 'en'); assert.deepEqual(next.locales.ar.fields[0], { name: 'email', type: 'email', required: true, label: 'البريد الإلكتروني', placeholder: '' }); assert.equal(next.priceMinor, 1500); assert.equal(next.status, 'draft'); assert.equal(record.locales.ar.fields, undefined); assert.throws(() => content.applyText(record, 'courses', 'ar', 'priceMinor', '1')); });
test('new translated page sections preserve linked collection and URLs', () => { const record = { locales: { ar: { sections: [{ type: 'collection', collection: 'courses', heading: 'دورات' }] } } }; const next = content.applyText(record, 'pages', 'en', 'sections.0.heading', 'Courses', 'ar'); assert.equal(next.locales.en.sections[0].collection, 'courses'); assert.equal(next.locales.en.sections[0].type, 'collection'); });
test('source edits mark translations outdated and manual review clears the status', () => { const old = { locales: { en: { title: 'Old' }, ar: { title: 'قديم' } } }; const changed = { locales: { en: { title: 'New' }, ar: { title: 'قديم' } } }; const state = content.buildTranslationState('courses', changed, old); assert.equal(state['en:title'].status, 'outdated'); const reviewed = content.buildTranslationState('courses', changed, old, state, ['en:title']); assert.equal(reviewed['en:title'].status, 'reviewed'); assert.notEqual(content.textHash('Old'), content.textHash('New')); });
test('manual draft and publish work without Gemini, with private translation metadata', async () => { reset(); const data = { status: 'draft', path: '/about', locales: { en: { title: 'About' }, ar: { title: 'عن الأكاديمية' } } }; assert.equal((await admin.POST(request('/api/admin/data?collection=pages', { id: 'about', data }))).status, 200); assert.equal((await admin.POST(request('/api/admin/data?collection=pages', { id: 'about', data: { ...data, status: 'published' } }))).status, 400); assert.equal((await admin.POST(request('/api/admin/data?collection=pages', { id: 'about', data: { ...data, status: 'published' }, translationReview: { reviewed: ['en:title', 'ar:title'] } }))).status, 200); assert.equal(rows.get('pages/about').translationState, undefined); assert.equal(rows.get('content_translation_state/pages__about').fields['ar:title'].status, 'reviewed'); const { publicRecord } = load('lib/public-record.ts'); assert.equal(publicRecord({ title: 'Public', translationState: { secret: true }, aiPaths: ['private'] }).translationState, undefined); });
test('optional empty public sections and duplicate headings/copy/forms are removed', () => { const clean = layout.cleanSections([{ heading: 'Empty' }, { heading: 'About', body: 'Intro' }, { type: 'text', heading: 'Details', body: 'Useful' }, { type: 'text', body: 'Useful' }, { type: 'form', formType: 'contact_inquiry' }, { type: 'form', formType: 'contact_inquiry' }], 'About', 'Intro'); assert.equal(clean.length, 2); assert.deepEqual(layout.uniqueCopy(['Same', ' same ', 'Other'], ['Other']), ['Same']); assert.equal(layout.usefulPublicRecord('news', { locales: { en: { title: 'News', body: 'Actual news' } } }, 'en'), true); assert.equal(layout.usefulPublicRecord('faqs', { locales: { en: { question: 'Empty answer?' } } }, 'en'), false); });
test('empty bilingual fields and inline AI actions render together without hiding either language', () => {
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  const { ContentFields } = load('components/ContentFields.tsx'), { ContentAssistant } = load('components/ContentAssistant.tsx');
  const record = { locales: { ar: { title: '', description: '' }, en: { title: 'Visible English', description: '' } } };
  const render = available => renderToStaticMarkup(React.createElement(ContentAssistant, { collection: 'courses', value: record, english: true, available, onReview() {}, onChange() {}, request: async () => ({ fields: [] }) }, React.createElement(ContentFields, { collection: 'courses', value: record, english: true, onChange() {}, request: async () => ({ items: [] }), onMediaUploaded: async () => {} })));
  const html = render(true); assert.match(html, /name="locales.ar.title"/); assert.match(html, /name="locales.en.title"/); assert.match(html, /name="locales.ar.description"/); assert.ok(html.includes('Visible English')); assert.ok(html.includes('To English')); assert.ok(html.includes('To العربية')); assert.ok(!html.includes('content-assistant"'));
  const manual = render(false); assert.ok(manual.includes('both languages can be edited manually')); assert.ok(manual.includes('Visible English')); assert.ok(!manual.includes('inline-ai-actions'));
});

test('content and inbox tables expose useful data before opening any record', () => {
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server'), { AdminRecordTable } = load('components/AdminRecordTable.tsx');
  const props = { collection: 'pages', items: [{ id: 'about', path: '/about', status: 'published', locales: { ar: { title: 'عن الأكاديمية' }, en: { title: 'About SEA' } } }], english: true, busy: false, loading: false, filter: '', onFilter() {}, statusFilter: 'all', onStatusFilter() {}, onChoose() {} };
  const html = renderToStaticMarkup(React.createElement(AdminRecordTable, props)); assert.ok(html.includes('<table')); for(const value of ['About SEA', 'عن الأكاديمية', '/about', 'Published', 'Arabic &amp; English']) assert.ok(html.includes(value), value); assert.ok(!html.includes('Choose an item'));
  const inbox = renderToStaticMarkup(React.createElement(AdminRecordTable, { ...props, collection: 'applications', items: [{ id: 'fake', status: 'new', fields: { fullName: 'Synthetic Learner', email: 'learner@example.invalid', program: 'Safety course' } }] }));
  for (const value of ['Synthetic Learner', 'learner@example.invalid', 'Safety course', 'Follow up']) assert.ok(inbox.includes(value), value);
});

test('overview automatically loads recent work within the current role permissions', async () => {
  reset(); rows.set('courses/course', { status: 'published', updatedAt: '2026-10-26T12:00:00Z', locales: { ar: { title: 'دورة آمنة' }, en: { title: 'Safety course' } } });
  rows.set('applications/applicant', { status: 'new', createdAt: '2026-10-26T13:00:00Z', fields: { fullName: 'Synthetic Learner', email: 'private@example.invalid' } });
  const overview = load('app/api/admin/overview/route.ts');
  const editor = await (await overview.GET(request('/api/admin/overview', null, 'editor'))).json();
  assert.ok(editor.recent.some(item => item.titleEn === 'Safety course')); assert.ok(!editor.recent.some(item => item.collection === 'applications'));
  const admissions = await (await overview.GET(request('/api/admin/overview', null, 'admissions'))).json();
  assert.ok(admissions.recent.some(item => item.titleEn === 'Synthetic Learner')); assert.ok(!admissions.recent.some(item => item.collection === 'courses')); assert.ok(!JSON.stringify(admissions).includes('private@example.invalid'));
  assert.equal((await overview.GET(request('/api/admin/overview', null, ''))).status, 401);
});

test("blank nested bilingual fields support drafting without allowing structural edits", () => {
  const { editableTextPairs, assistanceBatch, suggestionIsCurrent } = load("lib/admin/assistance.ts"); const record = { locales: { ar: { sections: [{ type: "text", buttonUrl: "/programs" }] } } };
  const pairs = editableTextPairs("pages", record, "ar", ["sections.0.heading", "sections.0.buttonUrl"]); assert.ok(pairs.some(pair => pair.key === "sections.0.heading" && pair.source === "")); assert.ok(!pairs.some(pair => pair.key === "sections.0.buttonUrl"));
  const batch = assistanceBatch(pairs, ["sections.0.heading"], "draft", "Use the supplied facts"); assert.equal(batch.length, 1); assert.ok(suggestionIsCurrent({ key: "sections.0.heading", sourceText: "", sourceHash: content.textHash("") }, pairs));
});

test("cohort autofill deduplicates loaded cohorts and fills both names without operational defaults", () => {
  const { cohortSuggestion } = load("lib/admin/cohort-autofill.ts");
  const program = { id: "course-crowd", collection: "courses", locales: { ar: { title: "إدارة الحشود" }, en: { title: "Crowd management" } } };
  const first = { id: "one", programCollection: "courses", programId: program.id, cohortCode: "CRO-01" };
  const result = cohortSuggestion(program, [first, first]);
  assert.equal(result.cohortCode, "CRO-02"); assert.equal(result.titleAr, "الدفعة الثانية - إدارة الحشود"); assert.equal(result.titleEn, "Cohort 2 - Crowd management");
  assert.deepEqual(Object.keys(result).sort(), ["programCollection", "programId", "cohortCode", "titleAr", "titleEn"].sort());
});
test("cohort autofill avoids code collisions and retains existing cohort codes", () => {
  const { cohortSuggestion } = load("lib/admin/cohort-autofill.ts");
  const program = { id: "course-crowd", collection: "courses", locales: { en: { title: "Crowd management" } } };
  const cohorts = [{ id: "other", programCollection: "programs", programId: "other", cohortCode: "cro-05" }];
  assert.equal(cohortSuggestion(program, cohorts).cohortCode, "CRO-06");
  const existing = cohortSuggestion(program, cohorts, { id: "saved", cohortCode: "CRO-02" });
  assert.equal(existing.cohortCode, "CRO-02"); assert.match(existing.titleEn, /^Cohort 2 /);
  assert.equal(cohortSuggestion({ id: "blank", collection: "courses" }, []), null);
});
test("cohort numbering distinguishes courses from programs with the same ID", () => {
  const { cohortSuggestion } = load("lib/admin/cohort-autofill.ts");
  const program = { id: "shared", collection: "courses", title: "Course" };
  const cohorts = [{ id: "other", programCollection: "programs", programId: "shared", cohortCode: "OTH-01" }];
  assert.equal(cohortSuggestion(program, cohorts).cohortCode, "SHA-01");
});
test("training program picker sees the published record when editing drafts exist", async () => {
  reset();
  rows.set("courses/live", { status: "published", locales: { ar: { title: "برنامج منشور" }, en: { title: "Published course" } } });
  rows.set("content_drafts/courses__live", { data: { status: "draft", locales: { ar: { title: "مسودة خاصة" }, en: { title: "Private draft" } } } });
  rows.set("courses/unpublished", { status: "draft", locales: { en: { title: "Unpublished course" } } });
  const picker = await (await admin.GET(request("/api/admin/data?collection=courses&view=published", null, "admin"))).json();
  assert.equal(picker.items.length, 1); assert.equal(picker.items[0].locales.en.title, "Published course"); assert.equal(picker.items[0].hasDraft, false);
  const editor = await (await admin.GET(request("/api/admin/data?collection=courses", null, "editor"))).json();
  assert.equal(editor.items.find(item => item.id === "live").locales.en.title, "Private draft");
  assert.equal((await admin.GET(request("/api/admin/data?collection=courses&view=published", null, "admissions"))).status, 403);
});

test("expanded autofill reuses matching cohort details and exact future dates", () => {
  const { cohortAutofill } = load("lib/admin/cohort-autofill.ts");
  const current = { id:"", programCollection:"courses", programId:"course-crowd", cohortCode:"",titleAr:"",titleEn:"",price:"",capacity:"",start:"",end:"",scheduleAr:"",scheduleEn:"",venueAr:"",venueEn:"",locationType:"in_person",status:"draft",registrationOpen:false };
  const program = { id:"course-crowd",collection:"courses",price:60,locales:{ ar:{title:"إدارة الحشود",hoursAndSchedule:"الأحد من التاسعة صباحاً"},en:{title:"Crowd management",hoursAndSchedule:"Sunday from 9 am"} } };
  const cohort = { id:"old",programCollection:"courses",programId:"course-crowd",cohortCode:"CRO-01",priceMinor:5000,capacity:45,startAt:"2026-11-01T06:00:00Z",endAt:"2026-11-01T12:00:00Z",scheduleAr:"جدول قديم",scheduleEn:"Previous schedule",venueAr:"مقر الرياض",venueEn:"Riyadh campus",locationType:"in_person",createdAt:100 };
  const result = cohortAutofill(program,[cohort],current,Date.parse("2026-10-27T00:00:00Z"));
  assert.equal(result.patch.price,"60"); assert.equal(result.patch.capacity,"45"); assert.equal(result.patch.start,"2026-11-01T09:00"); assert.equal(result.patch.end,"2026-11-01T15:00");
  assert.equal(result.patch.scheduleAr,program.locales.ar.hoursAndSchedule); assert.equal(result.patch.scheduleEn,program.locales.en.hoursAndSchedule); assert.equal(result.patch.venueEn,"Riyadh campus"); assert.deepEqual(result.missing,[]);
  assert.ok(!("status" in result.patch)); assert.ok(!("registrationOpen" in result.patch)); assert.ok(!("id" in result.patch));
  const entered={...current,price:"75",capacity:"40",start:"2026-12-01T09:00",end:"2026-12-01T13:00",venueAr:"موقع مخصص",venueEn:"Custom venue",locationType:"remote"};
  const kept=cohortAutofill(program,[cohort],entered,Date.parse("2026-10-27T00:00:00Z"),true);
  for(const key of ["price","capacity","start","end","venueAr","venueEn","locationType"])assert.ok(!(key in kept.patch),key);
});
test("autofill reports missing source fields and never reuses past cohort dates", () => {
  const { cohortAutofill } = load("lib/admin/cohort-autofill.ts");
  const current={ id:"",programCollection:"courses",programId:"one",cohortCode:"",titleAr:"",titleEn:"",price:"",capacity:"",start:"",end:"",scheduleAr:"",scheduleEn:"",venueAr:"",venueEn:"",locationType:"in_person",status:"draft",registrationOpen:false };
  const program={id:"one",collection:"courses",locales:{ar:{title:"دورة محلية"},en:{title:"Local course"}}};
  const result=cohortAutofill(program,[],current,Date.parse("2026-10-27T00:00:00Z"));
  for(const key of ["price","capacity","start","end","scheduleAr","scheduleEn","venueAr","venueEn"])assert.ok(result.missing.includes(key),key);
  const dateOnly=cohortAutofill({...program,startDate:"2026-11-01",endDate:"2026-11-02"},[],current,Date.parse("2026-10-27T00:00:00Z")); assert.equal(dateOnly.patch.start,undefined);
  const unrelated={id:"other",programCollection:"programs",programId:"one",venueEn:"Wrong venue",capacity:20};
  const past={id:"past",programCollection:"courses",programId:"one",startAt:"2026-01-01T06:00:00Z",endAt:"2026-01-01T09:00:00Z"};
  const old=cohortAutofill(program,[unrelated,past],current,Date.parse("2026-10-27T00:00:00Z"));
  assert.equal(old.patch.start,undefined); assert.equal(old.patch.venueEn,undefined);
});
test("cohort validation identifies missing bilingual fields before an API request and maps dates safely", () => {
  const { validateCohortForm,cohortFieldIssues }=load("lib/admin/cohort-form.ts");
  const blank={ id:"",programCollection:"courses",programId:"one",cohortCode:"CRO-01",titleAr:"دورة جديدة",titleEn:"New cohort",price:"60",capacity:"45",start:"2026-11-01T09:00",end:"2026-11-01T15:00",scheduleAr:"",scheduleEn:"",venueAr:"",venueEn:"",locationType:"in_person",status:"draft",registrationOpen:false };
  const invalid=validateCohortForm(blank,true);
  assert.equal(invalid.data,undefined); assert.deepEqual(invalid.issues.map(issue=>issue.path[0]),["scheduleAr","scheduleEn","venueAr","venueEn"]); assert.ok(invalid.issues.some(issue=>issue.message.includes("English venue")));
  const full={...blank,scheduleAr:"جدول تدريب صباحي",scheduleEn:"Morning training",venueAr:"مقر الرياض",venueEn:"Riyadh campus"};
  const valid=validateCohortForm(full,true); assert.equal(valid.issues.length,0); assert.equal(valid.data.priceMinor,6000); assert.equal(valid.data.startAt,"2026-11-01T06:00:00.000Z"); assert.equal(valid.data.status,"draft");
  assert.ok(validateCohortForm({...full,start:"bad"},false).issues.some(issue=>issue.path[0]==="start"));
  assert.ok(validateCohortForm({...full,end:"2026-10-01T15:00"},true).issues.some(issue=>issue.message.includes("after the start")));
  assert.equal(cohortFieldIssues([{path:["priceMinor"],message:"Invalid"}],true)[0].path[0],"price");
});
test("cohort template queries match both course collection and ID", async () => {
  reset(); rows.set("cohorts/match",{programCollection:"courses",programId:"one",createdAt:2}); rows.set("cohorts/wrong",{programCollection:"programs",programId:"one",createdAt:3}); rows.set("cohorts/other",{programCollection:"courses",programId:"two",createdAt:4});
  const { trainingQuery }=load("lib/booking/admin-query.ts");
  const {query}=trainingQuery(request("/api/admin/training?collection=cohorts&programCollection=courses&programId=one"));
  assert.deepEqual((await query.get()).docs.map(doc=>doc.id),["match"]);
  assert.throws(()=>trainingQuery(request("/api/admin/training?collection=cohorts&programCollection=bookings&programId=one")));
});

test("admin language links preserve the selected area, tab, record and fragment", () => {
  const { adminLanguageHref } = load("lib/admin/navigation.ts");
  const href = adminLanguageHref("?area=training&tab=cohorts&item=CRO-02&query=visitor+safety", "#cohort-editor");
  const parsed = new URL(href, "https://example.invalid");
  assert.equal(parsed.pathname, "/admin");
  assert.equal(parsed.searchParams.get("area"), "training"); assert.equal(parsed.searchParams.get("tab"), "cohorts");
  assert.equal(parsed.searchParams.get("item"), "CRO-02"); assert.equal(parsed.searchParams.get("query"), "visitor safety"); assert.equal(parsed.hash, "#cohort-editor");
  assert.equal(adminLanguageHref(""), "/admin"); assert.equal(adminLanguageHref("?tab=pages", "details"), "/admin?tab=pages#details");
});
test("admin language toggle has accessible actions for both interface languages", () => {
  const React = require("react"), { renderToStaticMarkup } = require("react-dom/server");
  const { AdminLanguageToggle } = load("components/AdminLanguageToggle.tsx");
  const english = renderToStaticMarkup(React.createElement(AdminLanguageToggle, { english:true, onSwitch(){} }));
  const arabic = renderToStaticMarkup(React.createElement(AdminLanguageToggle, { english:false, onSwitch(){} }));
  assert.match(english,/type="button"/); assert.ok(english.includes('aria-label="Switch dashboard to Arabic"')); assert.ok(english.includes('lang="ar">العربية'));
  assert.ok(arabic.includes('lang="en">English')); assert.ok(arabic.includes("تغيير لغة لوحة الإدارة إلى الإنجليزية"));
});
