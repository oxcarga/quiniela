#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "Seeding matches..."
FIRESTORE_EMULATOR_HOST=localhost:8080 npx tsx scripts/seed-matches.ts

echo "Seeding rankings..."
FIRESTORE_EMULATOR_HOST=localhost:8080 npx tsx scripts/seed-rankings.ts

echo "Done."
