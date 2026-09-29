#!/usr/bin/env python3
"""Train GUD's portable TF-IDF + logistic-regression classifier.

Only human editorial labels from private admin reviews may update the real dataset.
Synthetic fixtures bootstrap the cold-start classifier and are NEVER reported as
production accuracy. Automatic promotion requires an independent human gold set.
"""
import hashlib
import json
import sys
import unicodedata
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import precision_score, recall_score, confusion_matrix

ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT / 'data/training/editorial_seed.jsonl'
VALIDATED = ROOT / 'data/training/validated.jsonl'
GOLD = ROOT / 'data/training/gold.jsonl'
OUTPUT = ROOT / 'server/classification/model.json'
LABELS = ('not_constructive', 'constructive')


def normalize(value):
    value = unicodedata.normalize('NFKD', str(value).lower())
    return ''.join(char for char in value if not unicodedata.combining(char))


def load(path):
    if not path.exists():
        return []
    rows = []
    for n, line in enumerate(path.read_text(encoding='utf8').splitlines(), 1):
        if not line.strip():
            continue
        row = json.loads(line)
        if row.get('label') not in LABELS or not str(row.get('title', '')).strip():
            raise ValueError(f'Invalid editorial label at {path.name}:{n}')
        rows.append(row)
    # The same event must not become dozens of repeated training examples.
    unique = {}
    for row in rows:
        key = row.get('id') or hashlib.sha1(normalize(f"{row['title']} {row.get('deck','')}").encode()).hexdigest()
        unique[key] = row
    return list(unique.values())


def text(row):
    return f"{row['title']} {row.get('deck', '')}"


seed = load(SEED)
human = load(VALIDATED)
gold = load(GOLD)
# When the first 100 human labels arrive, they become the primary signal.
# Keep a small synthetic fraction to reduce early catastrophic forgetting.
rows = human + seed[:min(len(seed), 20, len(human)//4)] if len(human) >= 100 else seed + human
if len(rows) < 30 or len({row['label'] for row in rows}) < 2:
    sys.exit('Need >=30 diverse examples with both editorial classes.')

vectorizer = TfidfVectorizer(
    preprocessor=normalize,
    token_pattern=r'(?u)\b[a-z0-9]{2,}\b',
    ngram_range=(1, 2),
    sublinear_tf=True,
    norm='l2',
    lowercase=False,
)
X = vectorizer.fit_transform([text(row) for row in rows])
y = [int(row['label'] == 'constructive') for row in rows]
classifier = LogisticRegression(max_iter=1500, class_weight='balanced', random_state=19)
classifier.fit(X, y)

validated = False
metrics = None
if len(human) >= 100 and len(gold) >= 40 and len({r['label'] for r in gold}) == 2:
    # Real independent editorial gold; synthetic bootstrap never qualifies.
    heldout_keys = {normalize(text(r)) for r in rows}
    if any(normalize(text(r)) in heldout_keys for r in gold):
        sys.exit('Gold evaluation leaks training examples; candidate not promoted.')
    actual = [int(r['label'] == 'constructive') for r in gold]
    predicted = classifier.predict(vectorizer.transform([text(r) for r in gold]))
    tn, fp, fn, tp = confusion_matrix(actual, predicted, labels=[0,1]).ravel()
    precision = float(precision_score(actual, predicted, zero_division=0))
    recall = float(recall_score(actual, predicted, zero_division=0))
    fpr = float(fp/(fp + tn)) if fp + tn else 1
    metrics = {'precision': round(precision, 4), 'recall': round(recall, 4),
               'falsePositiveRate': round(fpr, 4), 'goldSamples': len(gold)}
    validated = precision >= 0.92 and fpr <= 0.08 and recall >= 0.50

fingerprint = hashlib.sha256('\n'.join(sorted(normalize(text(r)) + r['label'] for r in rows)).encode()).hexdigest()[:12]
output = {
    'version': f'gud-ml-{fingerprint}',
    'validated': validated,
    'samples': len(rows),
    'humanSamples': len(human),
    'validation': metrics,
    'classes': list(LABELS),
    'vocabulary': vectorizer.vocabulary_,
    'idf': [round(float(v), 9) for v in vectorizer.idf_],
    'weights': [round(float(v), 9) for v in classifier.coef_[0]],
    'intercept': round(float(classifier.intercept_[0]), 9),
    'note': ('Passed independent human gold gate.' if validated else
             'Advisory model only. Not validated for automatic rejection.'),
}
serialized = json.dumps(output, ensure_ascii=False, separators=(',', ':'))
# The stable fingerprint avoids a new deployed version when training data did not change.
OUTPUT.write_text(serialized + '\n', encoding='utf8')
print(f"GUD ML | samples={len(rows)} human={len(human)} gold={len(gold)} validated={validated} model={output['version']}")
if metrics:
    print(f"Gold evaluation: {metrics}")
