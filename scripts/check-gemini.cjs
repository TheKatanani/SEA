const { loadEnvConfig } = require('@next/env');
const { GoogleGenAI, ThinkingLevel } = require('@google/genai');
const { z } = require('zod');
loadEnvConfig(process.cwd(), false, { info() {}, error() {} });

async function main() {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
  const candidateModels = [
    process.env.GEMINI_MODEL,
    'gemini-3.5-flash',
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite'
  ].filter(Boolean);
  const models = [...new Set(candidateModels)];
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 20000 } });

  if (process.argv.includes('--model-only')) {
    let lastErr;
    for (const model of models) {
      try {
        await client.models.get({ model });
        console.log(JSON.stringify({ configured: true, model, status: 'ok', modelAccessible: true }));
        return;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  }

  let lastErr;
  for (const model of models) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: 'Translate the synthetic phrase "Academy training" into Arabic. Return JSON with a single text property. Do not add any facts.',
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false },
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          maxOutputTokens: 256
        }
      });
      const output = z.object({ text: z.string().min(2) }).strict().parse(JSON.parse(response.text || 'null'));
      if (!/[\u0600-\u06ff]/.test(output.text)) throw new Error('The translation did not contain Arabic');
      console.log(JSON.stringify({ configured: true, model, status: 'ok', structuredOutput: true, arabicOutput: true }));
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

main().catch(error => {
  const status = Number(error.status || error.code);
  const detail = String(error.message || '').replaceAll(process.env.GEMINI_API_KEY || 'NO_KEY_CONFIGURED', '[REDACTED]').replace(/(key=)[^\s&]+/gi, '$1[REDACTED]').slice(0, 350);
  console.error(JSON.stringify({ status: 'failed', category: Number.isFinite(status) ? status : error.name, cause: error.cause?.code, detail }));
  process.exitCode = 1;
});
