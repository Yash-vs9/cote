"""Merge hand-authored Q&A batches into chat-format train/val JSONL."""

import json
import random
from collections import Counter
from pathlib import Path

BATCH_DIR = Path(__file__).parent / "qa_batches"
OUT_DIR = Path(__file__).parent
SYSTEM_PROMPT = (
    "You are a knowledgeable assistant for the light novel "
    "'Classroom of the Elite' (Volume 1). Answer accurately and concisely "
    "based on the novel."
)
VAL_RATIO = 0.08
SEED = 42


def main():
    records, seen = [], set()
    per_chapter = Counter()
    for path in sorted(BATCH_DIR.glob("ch*.jsonl")):
        for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)  # raises on invalid JSON
            q, a = str(r["question"]).strip(), str(r["answer"]).strip()
            ch = int(r["chapter"])
            assert len(q) >= 10 and len(a) >= 10 and 1 <= ch <= 12
            key = " ".join(q.lower().split())
            if key in seen:
                continue
            seen.add(key)
            per_chapter[ch] += 1
            records.append(
                {
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": q},
                        {"role": "assistant", "content": a},
                    ]
                }
            )

    random.seed(SEED)
    random.shuffle(records)
    n_val = max(1, round(len(records) * VAL_RATIO))
    val, train = records[:n_val], records[n_val:]

    for name, data in (("finetune_train.jsonl", train), ("finetune_val.jsonl", val)):
        with open(OUT_DIR / name, "w", encoding="utf-8") as f:
            for r in data:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"total={len(records)} train={len(train)} val={len(val)}")
    for ch in sorted(per_chapter):
        print(f"  chapter {ch:>2}: {per_chapter[ch]} pairs")


if __name__ == "__main__":
    main()
