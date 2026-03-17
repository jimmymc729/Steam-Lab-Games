#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
IMAGE_GEN="$CODEX_HOME/skills/imagegen/scripts/image_gen.py"
JOBS_FILE="$PROJECT_DIR/pollinator-extras-jobs.jsonl"
OUT_DIR="$PROJECT_DIR/output/imagegen/pollinator-extras"

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

if [[ ! -f "$IMAGE_GEN" ]]; then
  echo "image_gen.py not found at: $IMAGE_GEN"
  echo "Install/enable the imagegen skill first."
  exit 1
fi

if [[ ! -f "$JOBS_FILE" ]]; then
  echo "Jobs file missing: $JOBS_FILE"
  exit 1
fi

if [[ "$DRY_RUN" -ne 1 && -z "${OPENAI_API_KEY:-}" ]]; then
  echo "OPENAI_API_KEY is not set."
  echo "Set your API key locally, then rerun this script."
  echo "Tip: run with --dry-run first to verify paths."
  exit 1
fi

mkdir -p "$OUT_DIR"

CMD=(
  python3 "$IMAGE_GEN" generate-batch
  --input "$JOBS_FILE"
  --out-dir "$OUT_DIR"
  --model gpt-image-1.5
  --size 1024x1024
  --quality high
  --background transparent
  --output-format png
  --concurrency 3
  --force
  --no-augment
)

if [[ "$DRY_RUN" -eq 1 ]]; then
  CMD+=(--dry-run)
fi

printf 'Running:\n  %q' "${CMD[0]}"
for ((i=1; i<${#CMD[@]}; i++)); do
  printf ' %q' "${CMD[i]}"
done
printf '\n\n'

"${CMD[@]}"

echo
echo "Done. Generated sprites are in: $OUT_DIR"
echo "Next: run scripts/build-pollinator-extras-sheet.py to pack them into one sheet."
