const fs = require('node:fs/promises');
const path = require('node:path');
const { loadDataset } = require('./lib/dataset');
const { DEFAULT_BASE_URL, DEFAULT_MODEL, askOllama, buildPrompt } = require('./lib/ollama');
const { scoreAnswer } = require('./lib/scoring');

async function writeResults(filePath, output) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
}

async function run({ model = process.env.OLLAMA_MODEL || DEFAULT_MODEL, baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL, outputFile = process.env.OUTPUT_FILE || path.join(__dirname, 'results', 'latest.json'), ask = askOllama } = {}) {
  const { experiments, questions } = await loadDataset();
  const results = [];
  for (const question of questions) {
    const answer = await ask({ model, baseUrl, prompt: buildPrompt(question, experiments) });
    results.push({ question_id: question.question_id, question: question.question, model_answer: answer, ...scoreAnswer(question, answer, experiments) });
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

if (require.main === module) {
  run().then((output) => console.log(`Wrote ${output.results.length} results to ${process.env.OUTPUT_FILE || 'task2/results/latest.json'} using ${output.model}.`)).catch((error) => {
    console.error(`Task 2 could not run: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { run, writeResults };