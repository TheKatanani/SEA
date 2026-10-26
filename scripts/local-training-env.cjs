const { generateKeyPairSync } = require('node:crypto');
const { loadEnvConfig } = require('@next/env');
const PROJECT_ID = 'demo-sea-training-local';
const ORIGIN = 'http://127.0.0.1:3101';
function localTrainingEnv() {
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
  const publicKey = process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY || '';
  const secretKey = process.env.MOYASAR_SECRET_KEY || '';
  if (!publicKey.startsWith('pk_test_') || !secretKey.startsWith('sk_test_')) throw new Error('Only Moyasar test keys are allowed in the local test harness.');
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  return {
    ...process.env,
    NODE_ENV: 'development',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:18080',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:19099',
    FIREBASE_PROJECT_ID: PROJECT_ID,
    GCLOUD_PROJECT: PROJECT_ID,
    GOOGLE_CLOUD_PROJECT: PROJECT_ID,
    FIREBASE_CONFIG: JSON.stringify({ projectId: PROJECT_ID }),
    // This generated signer has no Google account and cannot access any cloud project.
    FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: PROJECT_ID, client_email: 'local-qa@' + PROJECT_ID + '.iam.gserviceaccount.com', private_key: privateKey }),
    FIREBASE_CLIENT_EMAIL: '', FIREBASE_PRIVATE_KEY: '', GOOGLE_APPLICATION_CREDENTIALS: '',
    FIREBASE_OWNER_UID: 'local-qa-owner',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_API_KEY: 'local-demo-api-key',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'localhost',
    NEXT_PUBLIC_FIREBASE_APP_ID: 'local-demo-app',
    NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'true',
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: '',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '',
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: '',
    NEXT_PUBLIC_APP_URL: ORIGIN,
    NEXT_PUBLIC_MOYASAR_APPLE_PAY_ENABLED: 'false',
    BOOKINGS_ENABLED: 'true', APPLICATIONS_ENABLED: 'true', SITE_DEMO_MODE: 'true', SITE_INDEXING_ENABLED: 'false',
    FIREBASE_RATE_LIMIT_SECRET: 'local-emulator-only-submission-limit-secret-2026',
    PRIVACY_POLICY_VERSION: 'local-synthetic-test-only',
    BOOKING_ACCESS_SECRET: 'local-emulator-only-booking-access-secret-2026',
    TRAINING_JOB_SECRET: 'local-emulator-only-training-job-secret-2026',
    MOYASAR_WEBHOOK_SECRET: 'local-emulator-only-webhook-secret-2026',
    CLOUDINARY_API_KEY: '', CLOUDINARY_API_SECRET: '', CLOUDINARY_URL: '',
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: '',
    NEXT_TELEMETRY_DISABLED: '1',
    GEMINI_API_KEY: '',
  };
}
module.exports = { localTrainingEnv, PROJECT_ID, ORIGIN };
