# Qwen3-TTS + MFA lip-sync pipeline

This directory contains the offline preprocessing path. It is intentionally not an npm dependency and never writes generated audio, MFA output, or timelines into the Git worktree.

## Reproducible commands

Use a dedicated Python 3.11 environment for Qwen:

```bash
python3.11 -m venv /home/ws1/.cache/vrm-phase9-venv
/home/ws1/.cache/vrm-phase9-venv/bin/pip install qwen-tts soundfile

HF_HOME=/home/ws1/.cache/vrm-phase9-hf \
  /home/ws1/.cache/vrm-phase9-venv/bin/python generate_qwen_audio.py \
  --language Japanese --speaker ono_anna \
  --text 'これは日本語のリップシンク検証です。' \
  --output /home/ws1/.cache/vrm-phase9-artifacts/JP01.wav
```

The PoC pins `Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice` revision
`85e237c12c027371202489a0ec509ded67b5e4b5`. Use the same `ono_anna` speaker
for JP/EN/ZH so language is the independent variable. The script prints the
model revision, language, speaker, sample rate, duration, and output path.

MFA runs in Docker rather than the npm environment:

```bash
MFA_CACHE=/home/ws1/.cache/vrm-phase9-mfa \
  ./align_mfa.sh /home/ws1/.cache/vrm-phase9-corpus/japanese \
  japanese_mfa japanese_mfa \
  /home/ws1/.cache/vrm-phase9-align/japanese
```

Use `english_us_mfa english_mfa` and `mandarin_mfa mandarin_mfa` for English
and Mandarin. The wrapper mounts the host cache at `/mfa`, matching the
container's `MFA_ROOT_DIR`; its image default is
`mmcauliffe/montreal-forced-aligner:latest` and can be overridden with
`MFA_IMAGE`. MFA JSON/TextGrid files remain external.

Convert one MFA JSON and its WAV into the app's timeline format:

```bash
python3.11 build_timeline.py \
  --alignment /home/ws1/.cache/vrm-phase9-align/japanese/JP01.json \
  --audio /home/ws1/.cache/vrm-phase9-corpus/japanese/JP01.wav \
  --test-id JP01 --language ja --source-audio JP01.wav \
  --output /home/ws1/.cache/vrm-phase9-timelines/JP01.lipsync.json \
  --aligner-version 3.4.3.dev0+gd2dc283bd.d20260820
```

`build_timeline.py` is dependency-free. Its output is JSON schema version 1,
contains `duration`, `sampleRate`, `sourceAudio`, `sourceLanguage`, aligner
metadata, original phones, and weights limited to `aa`, `ih`, `ou`, `ee`, and
`oh`.

## Mapping policy

- Vowels map directly to the nearest VRM 1.0 mouth preset.
- MFA diphthong symbols are handled explicitly: `aj`/`aɪ` → `aa→ih`,
  `aw`/`aʊ` → `aa→ou`, `ow`/`oʊ` → `oh→ou`, and `ɔj`/`ɔɪ` → `oh→ih`.
- `ej`/`eɪ` uses `ee`; schwa uses `aa`; unvoiced/unknown consonants fall back
  to closed mouth (`aa=ih=ou=ee=oh=0`).
- The renderer uses the same mapper and validates all weights in `[0, 1]`.

## Verification helpers

```bash
python3.11 test_pipeline.py
python3.11 interpolation_report.py \
  /home/ws1/.cache/vrm-phase9-timelines/JP01.lipsync.json \
  --output /home/ws1/.cache/vrm-phase9-metrics/JP01-interpolation.json
```

The interpolation report compares `0`, `40`, `70`, and `100 ms` at a simulated
60 Hz render cadence. The runtime Debug Window also exposes those presets and
records the actual audio-clock session: cue latency p50/p95/max, signed end and
cumulative drift, refresh estimate, dropped/late frames, invalid weights, and
mouth-stuck events.
