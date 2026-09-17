const DIMENSIONS = ['retrieval_relevance', 'grounding', 'correctness', 'completeness', 'uncertainty'];
const ALL_IDS = /RW-CF-\d{3}/g;
const UNCERTAINTY_WORDS = /uncertain|inconclusive|insufficient|limited|conflict|not measured|no clear|should run|controlled comparison/i;
const IMPACT_MISUSE = /(impact|important).{0,80}(proves|means|shows).{0,40}(success|valid|scientific|effective)|(success|failure).{0,50}(because|due to).{0,30}(impact|important)/i;

function citedIds(answer) {
  return [...new Set(answer.match(ALL_IDS) || [])];
}

function scoreAnswer(question, answer, records) {
  const ids = citedIds(answer);
  const validIds = new Set(records.map((record) => record.experiment_id));
  const relevant = ids.filter((id) => question.expected_evidence.includes(id));
  const irrelevant = ids.filter((id) => validIds.has(id) && !question.expected_evidence.includes(id));
  const lowerAnswer = answer.toLowerCase();
  const termsFound = question.required_terms.filter((term) => lowerAnswer.includes(term));
  const mentionedRecords = records.filter((record) => ids.includes(record.experiment_id));
  const supportedOutcomeClaims = mentionedRecords.filter((record) =>
    lowerAnswer.includes(record.outcome) || lowerAnswer.includes(record.result.toLowerCase().slice(0, 24)),
  ).length;
  const hasUncertainty = UNCERTAINTY_WORDS.test(answer);
  const impactMisuse = IMPACT_MISUSE.test(answer);

  const scores = {
    retrieval_relevance: relevant.length >= question.minimum_ids ? (irrelevant.length ? 2 : 3) : relevant.length ? 1 : 0,
    grounding: relevant.length === 0 ? 0 : Math.min(3, supportedOutcomeClaims + 1),
    correctness: relevant.length >= question.minimum_ids && irrelevant.length === 0 ? (impactMisuse ? 1 : 3) : relevant.length ? 1 : 0,
    completeness: Math.min(3, relevant.length >= question.minimum_ids ? 2 + (termsFound.length === question.required_terms.length ? 1 : 0) : relevant.length),
    uncertainty: question.uncertainty_required ? (hasUncertainty ? 3 : 0) : (hasUncertainty ? 2 : 3),
  };
  const mean = DIMENSIONS.reduce((sum, dimension) => sum + scores[dimension], 0) / DIMENSIONS.length;
  return { scores, overall_mean: Number(mean.toFixed(2)), cited_ids: ids, relevant_ids: relevant, impact_misuse_detected: impactMisuse };
}

module.exports = { DIMENSIONS, scoreAnswer };