const fs = require('node:fs/promises');
const path = require('node:path');
const { loadDataset } = require('./lib/dataset');
const { DEFAULT_BASE_URL, DEFAULT_MODEL, askOllama, buildPrompt } = require('./lib/ollama');
const { scoreAnswer } = require('./lib/scoring');

async function writeResults(filePath, output) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
}

async function run({ model = process.env.OLLAMA_MODEL || DEFAULT_MODEL, baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL, outputFile = process.env.OUTPUT_FILE || path.join(__dirname, 'results', 'latest.json'), ask = askOllama, onProgress = () => {} } = {}) {
  const { experiments, questions } = await loadDataset();
  const results = [];
  for (const [index, question] of questions.entries()) {
    onProgress({ stage: 'asking', question_id: question.question_id, index: index + 1, total: questions.length });
    const startedAt = Date.now();
    let firstTokenSeen = false;
    const answer = await ask({
      model,
      baseUrl,
      prompt: buildPrompt(question, experiments),
      onToken: () => {
        if (firstTokenSeen) return;
        firstTokenSeen = true;
        onProgress({ stage: 'first_token', question_id: question.question_id, index: index + 1, total: questions.length, seconds: Math.round((Date.now() - startedAt) / 1000) });
      },
    });
    const scored = scoreAnswer(question, answer, experiments);
    onProgress({ stage: 'scored', question_id: question.question_id, index: index + 1, total: questions.length, seconds: Math.round((Date.now() - startedAt) / 1000), overall_mean: scored.overall_mean });
    results.push({ question_id: question.question_id, question: question.question, model_answer: answer, ...scored });
  }
  const output = {
    benchmark: 'Synes Task 2 fictional Rwanda coffee experiment benchmark',
    fictional_data: true,
    generated_at: new Date().toISOString(),
    model,
    ollama_base_url: baseUrl,
    scoring: { method: 'transparent deterministic heuristic using cited IDs and answer text; not objective ground truth', scale: '0-3 per dimension; overall_mean is the arithmetic mean of five dimensions' },
    results,
  };
  await writeResults(outputFile, output);
  return output;
}

function reportProgress(event) {
  const label = `[${event.index}/${event.total}] ${event.question_id}`;
  if (event.stage === 'asking') console.error(`${label}: asking the model...${event.index === 1 ? ' the first question reads the whole record set, so it is much slower than the rest' : ''}`);
  else if (event.stage === 'first_token') console.error(`${label}: first token after ${event.seconds}s, writing answer...`);
  else console.error(`${label}: done in ${event.seconds}s, overall_mean ${event.overall_mean}`);
}

if (require.main === module) {
  run({ onProgress: reportProgress }).then((output) => console.log(`Wrote ${output.results.length} results to ${process.env.OUTPUT_FILE || 'task2/results/latest.json'} using ${output.model}.`)).catch((error) => {
    console.error(`Task 2 could not run: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { run, writeResults };