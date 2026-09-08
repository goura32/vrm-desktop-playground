#!/usr/bin/env bash
# Align a WAV/text corpus with Montreal Forced Aligner in Docker.
# Usage: align_mfa.sh CORPUS_DIR DICTIONARY_MODEL ACOUSTIC_MODEL OUTPUT_DIR
set -euo pipefail

if [[ $# -ne 4 ]]; then
  printf 'usage: %s CORPUS_DIR DICTIONARY_MODEL ACOUSTIC_MODEL OUTPUT_DIR\n' "$0" >&2
  exit 2
fi

corpus_dir=$(realpath "$1")
dictionary_model=$2
acoustic_model=$3
output_dir=$(realpath -m "$4")
mfa_cache=${MFA_CACHE:-"$HOME/.cache/vrm-phase9-mfa"}
mfa_image=${MFA_IMAGE:-mmcauliffe/montreal-forced-aligner:latest}
mkdir -p "$output_dir" "$mfa_cache"

docker run --rm \
  -v "$corpus_dir:/data/corpus:ro" \
  -v "$output_dir:/data/output" \
  -v "$mfa_cache:/mfa" \
  "$mfa_image" \
  mfa align /data/corpus "$dictionary_model" "$acoustic_model" /data/output \
  --output_format json --single_speaker --num_jobs 2 --clean --final_clean --overwrite
