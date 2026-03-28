#!/usr/bin/env python3
"""
check_reviews.py — runs daily via cron.
Scans memory/decisions.csv and marks any row whose review_date
has passed (and is still PENDING) as REVIEW DUE.
"""

import csv
import sys
from datetime import date
from pathlib import Path

CSV_PATH = Path(__file__).parent.parent / "memory" / "decisions.csv"
FIELDS = ["date", "decision", "reasoning", "expected_outcome", "review_date", "status"]

def main():
    if not CSV_PATH.exists():
        print(f"[check_reviews] CSV not found: {CSV_PATH}")
        sys.exit(1)

    today = date.today()
    rows = []
    flagged = 0

    with open(CSV_PATH, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                review_date = date.fromisoformat(row["review_date"].strip())
            except ValueError:
                rows.append(row)
                continue

            if review_date <= today and row["status"].strip() == "PENDING":
                row["status"] = "REVIEW DUE"
                flagged += 1

            rows.append(row)

    with open(CSV_PATH, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS, quoting=csv.QUOTE_NONNUMERIC)
        writer.writeheader()
        writer.writerows(rows)

    if flagged:
        print(f"[check_reviews] {flagged} decision(s) marked REVIEW DUE — run review.sh to see them.")
    else:
        print(f"[check_reviews] No new reviews due today ({today}).")

if __name__ == "__main__":
    main()
