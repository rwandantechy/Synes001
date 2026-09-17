const http = require('node:http');
const https = require('node:https');

const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'qwen3:0.6b';
const DEFAULT_TIMEOUT_MS = 900000;
const DEFAULT_NUM_PREDICT = 500;
const DEFAULT_NUM_CTX = 8192;

const INSTRUCTIONS = `You are answering a scientist's question about a deliberately fictional Rwanda-only coffee experiment benchmark. Do not present these records as real findings or farming advice.\n\nUse only the records below. Cite experiment_id values for every important claim. Distinguish success, failure, conflict, and missing measurements. project_impact_score is only a fictional project-priority score from 1 to 10: it says how important a record is to inspect for the project, not whether the experiment succeeded and not whether its result is scientifically important or valid. A failed experiment may have high impact. If evidence is insufficient, say so and propose a controlled comparison only as a benchmark interpretation, not real-world advice.`;

// The records are the bulk of the prompt and are identical for every question, so they
// must stay ahead of the question text: that keeps the prefix byte-identical across the
// run and lets Ollama reuse its cached prompt evaluation instead of re-reading ~3.4k
// tokens per question, which costs minutes on a CPU-only host.
function buildPrompt(question, experiments) {
  const records = experiments.map((record) => JSON.stringify(record)).join('\n');
  return `${INSTRUCTIONS}\n\nRecords:\n${records}\n\nQuestion: ${question.question}\n\nAnswer:`;
}

// Uses node:http rather than fetch on purpose. A CPU-only host needs several minutes to
// evaluate the record set before the first token appears, and fetch aborts after 300s of
// waiting for response headers. Streaming keeps bytes moving so the timeout below only
// fires on a genuine stall.
function postStream({ url, body, timeoutMs, onToken }) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const transport = target.protocol === 'https:' ? https : http;
    const payload = Buffer.from(JSON.stringify(body), 'utf8');
    const request = transport.request(
      target,
      { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': payload.length }, timeout: timeoutMs },
      (response) => {
        let buffered = '';
        let answer = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          buffered += chunk;
          const lines = buffered.split('\n');
          buffered = lines.pop();
          for (const line of lines) {
            if (!line.trim()) continue;
            let parsed;
            try {
              parsed = JSON.parse(line);
            } catch {
              continue;
            }
            if (parsed.error) {
              request.destroy();
              reject(new Error(parsed.error));
              return;
            }
            if (parsed.response) {
              answer += parsed.response;
              if (onToken) onToken(parsed.response);
            }
          }
        });
        response.on('end', () => resolve({ statusCode: response.statusCode, answer, raw: buffered }));
        response.on('error', reject);
      },
    );
    request.on('timeout', () => request.destroy(new Error(`STALLED_AFTER_${timeoutMs}_MS`)));
    request.on('error', reject);
    request.end(payload);
  });
}

async function askOllama({ model, prompt, baseUrl = DEFAULT_BASE_URL, timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS), onToken, requestImpl = postStream }) {
  let result;
  try {
    result = await requestImpl({
      url: `${baseUrl.replace(/\/$/, '')}/api/generate`,
      body: { model, prompt, stream: true, think: false, options: { temperature: 0, num_predict: DEFAULT_NUM_PREDICT, num_ctx: DEFAULT_NUM_CTX } },
      timeoutMs,
      onToken,
    });
  } catch (error) {
    if (error.message.startsWith('STALLED_AFTER_')) {
      throw new Error(`Ollama sent nothing for ${timeoutMs / 1000}s. On a CPU-only host the first question has to read the whole record set, which is slow. Try a smaller model or raise OLLAMA_TIMEOUT_MS.`);
    }
    throw new Error(`Could not reach Ollama at ${baseUrl}: ${error.message}. Is Ollama running and is model "${model}" pulled?`);
  }
  if (result.statusCode !== 200) {
    throw new Error(`Ollama request failed (${result.statusCode}). Is Ollama running and is model "${model}" pulled? ${String(result.raw || '').slice(0, 240)}`);
  }
  if (!result.answer.trim()) throw new Error('Ollama returned no response text.');
  return result.answer.trim();
}

module.exports = { DEFAULT_BASE_URL, DEFAULT_MODEL, DEFAULT_TIMEOUT_MS, DEFAULT_NUM_PREDICT, DEFAULT_NUM_CTX, buildPrompt, askOllama };