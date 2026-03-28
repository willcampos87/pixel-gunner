#!/usr/bin/env bash
# review.sh — surfaces all decisions flagged REVIEW DUE
# Usage: ./scripts/review.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CSV="$SCRIPT_DIR/../memory/decisions.csv"

if [[ ! -f "$CSV" ]]; then
  echo "Error: decisions.csv not found at $CSV"
  exit 1
fi

# Count flagged rows (skip header)
COUNT=$(tail -n +2 "$CSV" | python3 -c "
import csv, sys
rows = [r for r in csv.DictReader(sys.stdin) if r.get('status','').strip() == 'REVIEW DUE']
print(len(rows))
")

if [[ "$COUNT" -eq 0 ]]; then
  echo "No decisions pending review. All clear."
  exit 0
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              DECISIONS REQUIRING REVIEW ($COUNT found)           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

python3 - "$CSV" <<'PYEOF'
import csv, sys

path = sys.argv[1]
with open(path, newline="") as f:
    rows = [r for r in csv.DictReader(f) if r.get("status", "").strip() == "REVIEW DUE"]

for i, r in enumerate(rows, 1):
    print(f"  [{i}] DECISION:         {r['decision']}")
    print(f"      Made on:          {r['date']}")
    print(f"      Reasoning:        {r['reasoning']}")
    print(f"      Expected outcome: {r['expected_outcome']}")
    print(f"      Review date:      {r['review_date']}")
    print()
PYEOF

echo "To mark a decision as reviewed, update its status in:"
echo "  memory/decisions.csv"
echo ""
