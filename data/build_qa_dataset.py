"""Build the chat-format Q&A finetuning dataset from locally authored QA parts.

Pipeline:
  1. Load all JSON part files from qa_parts/ (authored in-repo, no external LLM).
  2. Validate, dedupe, convert to OpenAI chat format.
  3. Shuffle (seeded) and write train/val JSONL split.
"""

import glob
import json
import os
import random
import re
import sys

OUT_DIR = os.path.dirname(__file__)
VAL_RATIO = 0.05
SEED = 42


def resolve_paths(argv):
    if len(argv) >= 3:
        part_dir, train_name, val_name = argv[0], argv[1], argv[2]
    elif len(argv) == 1:
        stem = os.path.basename(argv[0].rstrip("/"))
        part_dir, train_name, val_name = (
            argv[0],
            f"train_{stem}.jsonl",
            f"val_{stem}.jsonl",
        )
    else:
        part_dir = "qa_parts"
        train_name, val_name = "train.jsonl", "val.jsonl"
    if not os.path.isabs(part_dir):
        part_dir = os.path.join(OUT_DIR, part_dir)
    m = re.search(r"vol(?:ume)?[_-]?(\d+)", os.path.basename(part_dir), re.IGNORECASE)
    volume = f"Volume {m.group(1)}" if m else "Volume 1"
    return part_dir, train_name, val_name, volume

SYSTEM_PROMPT = (
    "You are a knowledgeable assistant for the light novel "
    '"Classroom of the Elite" ({}). Answer accurately '
    "and concisely based on the novel."
)


def main():
    part_dir, train_name, val_name, volume = resolve_paths(sys.argv[1:])
    system_prompt = SYSTEM_PROMPT.format(volume)
    random.seed(SEED)
    records, seen = [], set()
    for path in sorted(glob.glob(os.path.join(part_dir, "*.json"))):
        with open(path, encoding="utf-8") as f:
            items = json.load(f)
        for item in items:
            q = str(item.get("q", "")).strip()
            a = str(item.get("a", "")).strip()
            source = str(item.get("source", "")).strip()
            key = q.lower()
            if len(q) < 15 or len(a) < 10 or key in seen:
                continue
            seen.add(key)
            records.append(
                {
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": q},
                        {"role": "assistant", "content": a},
                    ],
                    "source": source,
                }
            )
        print(f"{os.path.basename(path)}: {len(items)} pairs")

    random.shuffle(records)
    n_val = max(1, int(len(records) * VAL_RATIO))
    val, train = records[:n_val], records[n_val:]

    for name, data in ((train_name, train), (val_name, val)):
        path = os.path.join(OUT_DIR, name)
        with open(path, "w", encoding="utf-8") as f:
            for r in data:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(f"wrote {path}: {len(data)} examples")

    chapters = sorted({r["source"] for r in records})
    print(f"total={len(records)} across {len(chapters)} sources")
    for c in chapters:
        count = sum(1 for r in records if r["source"] == c)
        print(f"  {count:3d}  {c}")


if __name__ == "__main__":
    main()
