# Synes Task 2 Benchmark

This is a small JavaScript benchmark for asking an Ollama model questions about experiment history.

The story is intentionally fictional: coffee experiments in Rwanda. The goal is to see whether a model can find the right records, stay close to the evidence, notice gaps and conflicts, and express uncertainty.

The runnable benchmark lives in `task2/`.

## Quick start

You need Node.js 18+ and [Ollama](https://ollama.com/download).

```sh
ollama pull llama3.2:1b
npm install
npm test
npm run run:task2
```

The last command asks all five questions and writes the answers to `task2/results/latest.json`.

If Ollama is not running, or the model has not been downloaded, the command stops with a clear setup error. The example above uses `llama3.2:1b`; the model and local Ollama URL are configurable:

```sh
OLLAMA_MODEL=llama3.2:latest npm run run:task2
OLLAMA_BASE_URL=http://127.0.0.1:11434 npm run run:task2
OUTPUT_FILE=task2/results/my-run.json npm run run:task2
```

## What is in the dataset?

There are 15 separate experiment logs and five scientist-style questions. The locations are in Rwanda, and every record is explicitly marked as a fictional synthetic record. The data should not be read as agricultural research, farming advice, or real-world evidence.

Each experiment contains:

`experiment_id`, `research_goal`, `location`, `coffee_variety`, `protocol`, `parameters`, `outcome`, `result`, `failure_mode`, `change_from_previous`, `notes`, `project_impact_score`, optional `impact_reason`, `lab_id`, and `owner_id`.

The records deliberately contain successes, failures, related trials, conflicting results, missing measurements, and inconclusive follow-ups. That gives the questions something meaningful to test.

### Project impact score

`project_impact_score` is fictional project-priority metadata from 1 to 10. It answers: “How important is this experiment for deciding what the project should inspect next?”

It does **not** mean that an experiment succeeded, that its result is scientifically strong, or that it matters in real agriculture. A failed experiment can have a high impact score when the failure changes the project’s next step. The model is instructed to keep that distinction, and the scorer flags answers that use impact as proof of success or validity.

## How scoring works

Each answer receives a score from 0 to 3 for five dimensions:

- retrieval relevance
- grounding
- correctness
- completeness
- uncertainty

The overall score is the arithmetic mean of those five dimension scores. Individual scores are kept in the output so a single average does not hide where an answer performed poorly.

The scorer is a transparent, deterministic heuristic. It checks the experiment IDs cited by the answer, whether those records are relevant to the question, whether the answer includes evidence from the records, and whether uncertainty is acknowledged when it matters. These are regression signals, not objective truth labels.

The benchmark can help catch irrelevant retrieval, unsupported claims, missed or contradictory evidence, overconfident answers when evidence is insufficient, and misuse of the project impact score.

It cannot reliably tell us whether a claim is scientifically correct in the real world, whether scientists trust or use the answer, whether it will remain useful over time, whether it contains subtle domain errors, whether a recommendation will work in a real farm trial, or how well synthetic data represents production data.

**This harness is an early regression test, not proof of scientific correctness.**

## Tests

Run the tests without Ollama:

```sh
npm test
```

The tests cover dataset loading, fictional labels, valid impact scores, dimension-by-dimension scoring, detection of impact-score misuse, and output generation with an injected model function. A live benchmark run additionally requires a running Ollama service and a pulled model.