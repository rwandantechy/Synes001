# Synes Task 2 Benchmark

This repository contains the existing Synes Python Lambda experiments plus a separate JavaScript Task 2 evaluation harness in `task2/`. The harness sends five scientist-style questions and 15 experiment logs to a locally running Ollama model, saves each answer, and scores it.

## Dataset

The dataset is a deliberately fictional, Rwanda-only coffee-growing scenario. Every JSON object is one experiment, not a multi-field description of one experiment. Records use:

`experiment_id`, `research_goal`, `location`, `coffee_variety`, `protocol`, `parameters`, `outcome`, `result`, `failure_mode`, `change_from_previous`, `notes`, `project_impact_score`, optional `impact_reason`, `lab_id`, and `owner_id`.

`project_impact_score` is fictional metadata from 1 to 10 describing how important an experiment is to the overall project. It does not describe success, scientific quality, or real-world importance. A failed experiment can have a high score; for example, a failed replication can still strongly affect what the project should inspect next.

The records include successes, failures, related trials, conflicting results, missing endpoints, and insufficient evidence. They are clearly labeled as fictional and must not be treated as agricultural findings or farming advice.

## Setup and run

Requirements: Node.js 18+ and Ollama.

1. Install Ollama from [ollama.com](https://ollama.com/download).
2. Start Ollama, then pull a local model, for example: `ollama pull llama3.2:3b`.
3. From this repository, run `npm run run:task2`.

The default model is `llama3.2:3b`. Configure it with `OLLAMA_MODEL=your-model npm run run:task2`. Configure the endpoint with `OLLAMA_BASE_URL=http://127.0.0.1:11434`. Use `OUTPUT_FILE=task2/results/my-run.json` to choose the output path. If Ollama is stopped or the model is not pulled, the harness exits with a setup error.

The output records the model name, Ollama URL, timestamp, each question, each answer, all five dimension scores, cited IDs, impact-misuse detection, and the overall mean.

## Rubric

Each answer receives 0–3 for retrieval relevance, grounding, correctness, completeness, and uncertainty. The overall mean is the arithmetic mean of those five preserved dimension scores. The scorer is a transparent deterministic heuristic: it checks expected experiment IDs, whether cited records are relevant, whether answer text includes evidence terms, and whether uncertainty is acknowledged where the question requires it. It is not an objective truth label and does not replace review.

The metric can catch irrelevant retrieval, unsupported claims, missed or contradictory evidence, overconfident answers when evidence is insufficient, and answers that treat project impact as proof of success or scientific validity. It cannot reliably catch real-world scientific correctness, whether scientists trust or use the answer, long-term usefulness, subtle domain errors, whether recommendations work in a real farm trial, or differences between synthetic and production data.

**This harness is an early regression test, not proof of scientific correctness.**

## Tests

Run the dependency-free tests with:

```sh
npm test
```

Tests cover dataset loading and fictional labels, dimension-preserving scoring, and output generation through an injected local-model function. The tests do not require Ollama. A real benchmark run does require a running Ollama service and a pulled model.