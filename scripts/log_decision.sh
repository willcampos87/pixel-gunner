#!/usr/bin/env bash
# log_decision.sh — append a new decision to decisions.csv
# Usage: ./scripts/log_decision.sh
# (interactive prompts)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CSV="$SCRIPT_DIR/../memory/decisions.csv"

echo ""
echo "=== Log a New Decision ==="
echo ""

read -r -p "Decision (what was decided):    " DECISION
read -r -p "Reasoning (why):                " REASONING
read -r -p "Expected outcome (what we want): " OUTCOME

DATE=$(date +%Y-%m-%d)
REVIEW_DATE=$(date -v +30d +%Y-%m-%d 2>/dev/null || date -d "+30 days" +%Y-%m-%d)
STATUS="PENDING"

python3 - "$CSV" "$DATE" "$DECISION" "$REASONING" "$OUTCOME" "$REVIEW_DATE" "$STATUS" <<'PYEOF'
import csv, sys

path, date, decision, reasoning, outcome, review_date, status = sys.argv[1:]
fields = ["date", "decision", "reasoning", "expected_outcome", "review_date", "status"]
row = {
    "date": date,
    "decision": decision,
    "reasoning": reasoning,
    "expected_outcome": outcome,
    "review_date": review_date,
    "status": status,
}

with open(path, "a", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=fields, quoting=csv.QUOTE_NONNUMERIC)
    writer.writerow(row)

print(f"\nLogged: \"{decision}\"")
print(f"Review due: {review_date}")
PYEOF
