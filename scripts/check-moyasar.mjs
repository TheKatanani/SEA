import nextEnv from '@next/env';
import { randomUUID } from 'node:crypto';

// Read-only account connectivity check. Never print keys or provider payment data.
nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const publicKey = process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY || '';
const secretKey = process.env.MOYASAR_SECRET_KEY || '';
const result = {
  testPublishableKeyConfigured: /^pk_test_[A-Za-z0-9_-]+$/.test(publicKey),
  testSecretKeyConfigured: /^sk_test_[A-Za-z0-9_-]+$/.test(secretKey),
  secretKeyAuthenticated: false,
  publishableKeyAccountMatch: 'requires SDK payment test',
  bookingsEnabled: process.env.BOOKINGS_ENABLED === 'true',
  missingActivationSettings: [
    ...(!process.env.NEXT_PUBLIC_APP_URL ? ['NEXT_PUBLIC_APP_URL'] : []),
    ...(!process.env.MOYASAR_WEBHOOK_SECRET ? ['MOYASAR_WEBHOOK_SECRET'] : []),
    ...(!process.env.PRIVACY_POLICY_VERSION || process.env.PRIVACY_POLICY_VERSION === 'pending-approval' ? ['PRIVACY_POLICY_VERSION'] : []),
  ],
};

if (!result.testPublishableKeyConfigured || !result.testSecretKeyConfigured) {
  result.error = 'TEST_KEYS_MISSING_OR_INVALID';
  process.exitCode = 1;
} else {
  try {
    // A random payment filter avoids retrieving the account's payment history.
    const url = new URL('https://api.moyasar.com/v1/payments');
    url.searchParams.set('id', randomUUID());
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: 'Basic ' + Buffer.from(secretKey + ':').toString('base64') },
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    });
    result.providerHttpStatus = response.status;
    if (response.ok) {
      const payload = await response.json();
      result.secretKeyAuthenticated = Array.isArray(payload.payments);
      if (!result.secretKeyAuthenticated) result.error = 'UNEXPECTED_PROVIDER_RESPONSE';
    } else {
      result.error = [401, 403].includes(response.status) ? 'PROVIDER_AUTH_REJECTED' : 'PROVIDER_CHECK_FAILED';
      await response.body?.cancel();
    }
    if (!result.secretKeyAuthenticated) process.exitCode = 1;
  } catch {
    result.error = 'PROVIDER_NETWORK_CHECK_FAILED';
    process.exitCode = 1;
  }
}
console.log(JSON.stringify(result, null, 2));
