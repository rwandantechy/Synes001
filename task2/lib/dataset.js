const fs = require('node:fs/promises');
const path = require('node:path');

const dataDirectory = path.join(__dirname, '..', 'data');

async function loadJson(name) {
  const text = await fs.readFile(path.join(dataDirectory, name), 'utf8');
  return JSON.parse(text);
}

async function loadDataset() {
  const [experiments, questions] = await Promise.all([
    loadJson('experiments.json'),
    loadJson('questions.json'),
  ]);
  if (experiments.length !== 15 || questions.length !== 5) {
    throw new Error('Task 2 expects 15 experiments and 5 questions.');
  }
  if (experiments.some((record) => !record.notes.includes('FICTIONAL SYNTHETIC RECORD'))) {
    throw new Error('Every experiment must be labeled as fictional.');
  }
  if (experiments.some((record) => !Number.isInteger(record.project_impact_score) || record.project_impact_score < 1 || record.project_impact_score > 10)) {
    throw new Error('Every experiment must have a fictional project_impact_score from 1 to 10.');
  }
  return { experiments, questions };
}

function recordForPrompt(record) {
  return JSON.stringify(record);
}

module.exports = { loadDataset, recordForPrompt };