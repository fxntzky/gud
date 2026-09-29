import { readFileSync } from 'node:fs';

// Portable inference for an offline-trained TF–IDF + logistic regression model.
// A bundled bootstrap model is advisory until tested against real validated news.
let model;
try {
  model = JSON.parse(readFileSync(new URL('./model.json', import.meta.url), 'utf8'));
} catch {
  model = null;
}

export const getMLStatus = () => ({
  available: Boolean(model),
  version: model?.version ?? 'untrained',
  trainingSamples: model?.samples ?? 0,
  humanSamples: model?.humanSamples ?? 0,
  validation: model?.validation ?? null,
  mode: process.env.GUD_ML_HARD_FILTER === 'true' && model?.validated === true
    ? 'validated-filter'
    : 'advisory',
});

const features = (input) => {
  const words = String(input).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().match(/[a-z0-9]{2,}/g) ?? [];
  const result = [...words];
  for (let i = 0; i < words.length - 1; i++) result.push(`${words[i]} ${words[i + 1]}`);
  return result;
};

export function classifyML({ title = '', deck = '' } = {}) {
  if (!model) return { label: 'unknown', confidence: null, margin: null, version: 'untrained' };
  const tokens = features(`${title} ${deck}`);
  const tf = new Map();
  for (const token of tokens) if (Object.hasOwn(model.vocabulary, token)) tf.set(token, (tf.get(token) ?? 0) + 1);
  let norm = 0;
  let margin = model.intercept;
  const values = [];
  for (const [token, count] of tf) {
    const index = model.vocabulary[token];
    const value = (1 + Math.log(count)) * model.idf[index];
    norm += value * value;
    values.push([index, value]);
  }
  norm = Math.sqrt(norm) || 1;
  for (const [index, value] of values) margin += model.weights[index] * value / norm;
  const probability = 1 / (1 + Math.exp(-margin));
  return {
    label: probability >= 0.5 ? 'constructive' : 'not_constructive',
    // Uncalibrated model probability: use for ranking, never represent as verified accuracy.
    confidence: Number(probability.toFixed(4)),
    margin: Number(margin.toFixed(4)),
    version: model.version,
  };
}
