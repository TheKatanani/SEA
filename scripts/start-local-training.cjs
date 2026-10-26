const { spawn } = require('node:child_process');
const path = require('node:path');
const { localTrainingEnv, PROJECT_ID, ORIGIN } = require('./local-training-env.cjs');
const env = localTrainingEnv();
if (process.argv.includes('--ai')) {
  if (!process.env.GEMINI_API_KEY) throw new Error('Add GEMINI_API_KEY locally before enabling live synthetic AI checks.');
  env.GEMINI_API_KEY = process.env.GEMINI_API_KEY;
}
const production = process.argv.includes('--production');
if (production) env.NODE_ENV = 'production';
console.log('Local test app: ' + ORIGIN + ' | Firebase emulator project: ' + PROJECT_ID + ' | Moyasar: test mode only');
const child = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), production ? 'start' : 'dev', '--hostname', '127.0.0.1', '--port', '3101'], { env, stdio: 'inherit' });
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
child.on('exit', code => { process.exitCode = code || 0; });
