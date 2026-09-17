const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'llama3.2:1b';

function buildPrompt(question, experiments) {
  const records = experiments.map((record) => JSON.stringify(record)).join('\n');
  return `You are answering a scientist's question about a deliberately fictional Rwanda-only coffee experiment benchmark. Do not present these records as real findings or farming advice.\n\nQuestion: ${question.question}\n\nUse only the records below. Cite experiment_id values for every important claim. Distinguish success, failure, conflict, and missing measurements. project_impact_score is only a fictional project-priority score from 1 to 10: it says how important a record is to inspect for the project, not whether the experiment succeeded and not whether its result is scientifically important or valid. A failed experiment may have high impact. If evidence is insufficient, say so and propose a controlled comparison only as a benchmark interpretation, not real-world advice.\n\nRecords:\n${records}`;
}

async function askOllama({ model, prompt, baseUrl = DEFAULT_BASE_URL, fetchImpl = fetch }) {
  const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0 } }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Ollama request failed (${response.status}). Is Ollama running and is model "${model}" pulled? ${detail.slice(0, 240)}`);
  }
  const payload = await response.json();
  if (!payload.response) throw new Error('Ollama returned no response text.');
  return payload.response.trim();
}

module.exports = { DEFAULT_BASE_URL, DEFAULT_MODEL, buildPrompt, askOllama };