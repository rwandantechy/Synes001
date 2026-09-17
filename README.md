# Synes Task 2 Benchmark

This is a small JavaScript benchmark for asking an Ollama model questions about experiment history.

The story is intentionally fictional: coffee experiments in Rwanda. The goal is to see whether a model can find the right records, stay close to the evidence, notice gaps and conflicts, and express uncertainty.

The runnable benchmark lives in `task2/`.

## Quick start

You need Node.js 18+ and [Ollama](https://ollama.com/download).

```sh
ollama pull qwen3:0.6b
npm install
npm test
npm run run:task2
```

The last command asks all five questions and writes the answers to `task2/results/latest.json`.

If Ollama is not running, or the model has not been downloaded, the command stops with a clear setup error. The example above uses lightweight `qwen3:0.6b`; the model and local Ollama URL are configurable:

```sh
OLLAMA_MODEL=qwen3:0.6b npm run run:task2
OLLAMA_BASE_URL=http://127.0.0.1:11434 npm run run:task2
OUTPUT_FILE=task2/results/my-run.json npm run run:task2
OLLAMA_TIMEOUT_MS=900000 npm run run:task2
```

Each answer is capped at 500 tokens and the run prints per-question progress to stderr.

### How long a run takes

All five questions send the same 15 records, so the records are placed ahead of the question in the prompt. That keeps the prompt prefix identical across questions and lets Ollama reuse its cached prompt evaluation, which matters a lot without a GPU.

On a CPU-only machine (`ollama ps` showing `100% CPU`), a measured run with `qwen3:0.6b` looked like this:

| Question | Time to first token | Total |
| --- | --- | --- |
| Q1 (cold prompt) | 279s | 375s |
| Q2–Q5 (cached prefix) | 6–7s | 43–77s |

That is about ten minutes end to end, with the first question accounting for most of it. A repeat run started while Ollama still had the model and prompt cached finished in under four minutes and produced identical scores, since the requests use `temperature: 0`. `OLLAMA_TIMEOUT_MS` (default 15 minutes) is a stall timeout: it only trips if Ollama sends nothing at all for that long, so it does not need to be sized to the total run. On a GPU machine the whole run takes well under a minute.

Requests are streamed over `node:http` rather than `fetch`, because `fetch` gives up after 300 seconds of waiting for response headers and that alone is enough to make a CPU-only run fail before the first answer arrives.

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

### A measured baseline

`qwen3:0.6b` scored an overall mean of **1.68 out of 3** across the five questions (per question: 2.2, 2.2, 1.0, 1.2, 1.8). The per-dimension scores show *where* it struggled rather than just that it did: on Q1 it cited all fifteen records instead of selecting the relevant ones, on Q3 it never acknowledged uncertainty where the question requires it, and on Q4 it cited mostly irrelevant records. A tiny model landing in the middle of the range, with different failures per question, is the behaviour a useful regression metric should show.

The scorer is a transparent, deterministic heuristic. It checks the experiment IDs cited by the answer, whether those records are relevant to the question, whether the answer includes evidence from the records, and whether uncertainty is acknowledged when it matters. These are regression signals, not objective truth labels.

The benchmark can help catch irrelevant retrieval, unsupported claims, missed or contradictory evidence, overconfident answers when evidence is insufficient, and misuse of the project impact score.

It cannot reliably tell us whether a claim is scientifically correct in the real world, whether scientists trust or use the answer, whether it will remain useful over time, whether it contains subtle domain errors, whether a recommendation will work in a real farm trial, or how well synthetic data represents production data.

It is also gameable in ways the measured run made visible. Because retrieval relevance only drops from 3 to 2 when irrelevant IDs appear, an answer that cites *every* record still scores 2 out of 3 on that dimension, which is how Q1 scored above. Uncertainty is matched on phrasing, so an answer can earn the points by saying "a controlled comparison is needed" without that caveat being connected to anything. Grounding counts whether cited records' outcome words reappear in the text, which rewards restating the record rather than reasoning about it. Treat these numbers as a regression signal that catches obvious degradation, not as a leaderboard to optimise against.

**This harness is an early regression test, not proof of scientific correctness.**

## Tests

Run the tests without Ollama:

```sh
npm test
```

The tests cover dataset loading, fictional labels, valid impact scores, dimension-by-dimension scoring, detection of impact-score misuse, and output generation with an injected model function. A live benchmark run additionally requires a running Ollama service and a pulled model.