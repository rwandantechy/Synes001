const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { loadDataset } = require('../lib/dataset');
const { scoreAnswer } = require('../lib/scoring');
const { run } = require('../run');

test('loads 15 fictional records and five questions', async () => {
  const { experiments, questions } = await loadDataset();
  assert.equal(experiments.length, 15);
  assert.equal(questions.length, 5);
  assert.ok(experiments.every((record) => record.location.endsWith(', Rwanda')));
  assert.ok(experiments.every((record) => record.notes.includes('FICTIONAL SYNTHETIC RECORD')));
  assert.ok(experiments.every((record) => Number.isInteger(record.project_impact_score) && record.project_impact_score >= 1 && record.project_impact_score <= 10));
  assert.ok(experiments.some((record) => record.outcome === 'failure' && record.project_impact_score >= 9));
  assert.ok(experiments.some((record) => record.outcome === 'success'));
  assert.ok(experiments.some((record) => record.outcome === 'failure'));
});

test('scores cited, grounded and uncertain evidence without hiding dimensions', async () => {
  const { experiments, questions } = await loadDataset();
  const answer = 'Evidence is limited. RW-CF-001 found more cherries with mulch, while RW-CF-002 failed under high shade. A controlled comparison is still needed.';
  const scored = scoreAnswer(questions[0], answer, experiments);
  assert.equal(scored.relevant_ids.length, 2);
  assert.deepEqual(Object.keys(scored.scores), ['retrieval_relevance', 'grounding', 'correctness', 'completeness', 'uncertainty']);
  assert.equal(scored.scores.retrieval_relevance, 3);
  assert.equal(typeof scored.overall_mean, 'number');
});

test('penalizes treating project impact as proof of success or scientific validity', async () => {
  const { experiments, questions } = await loadDataset();
  const answer = 'RW-CF-015 has high project impact, which proves the mulch approach is scientifically valid and successful.';
  const scored = scoreAnswer(questions[3], answer, experiments);
  assert.equal(scored.impact_misuse_detected, true);
  assert.ok(scored.scores.correctness < 3);
});

test('runs with an injected local-model function and writes reproducible output', async () => {
  const outputFile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'synes-task2-')), 'results.json');
  const output = await run({ model: 'test-local-model', outputFile, ask: async ({ prompt }) => {
    assert.match(prompt, /RW-CF-001/);
    return 'Evidence is insufficient; inspect RW-CF-001 and RW-CF-002 before a controlled comparison.';
  } });
  const saved = JSON.parse(await fs.readFile(outputFile, 'utf8'));
  assert.equal(saved.model, 'test-local-model');
  assert.equal(saved.results.length, 5);
  assert.equal(saved.results[0].question_id, 'Q1');
  assert.ok(saved.results.every((result) => result.scores && typeof result.overall_mean === 'number'));
});