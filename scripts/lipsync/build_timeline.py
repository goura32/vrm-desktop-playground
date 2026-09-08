#!/usr/bin/env python3
"""Convert one MFA JSON phone tier and its WAV into a LipSyncTimeline v1."""

from __future__ import annotations

import argparse
import json
import wave
from pathlib import Path

from lipsync_pipeline import build_timeline, parse_mfa_json


def wav_duration(path: Path) -> float:
    with wave.open(str(path), "rb") as handle:
        return handle.getnframes() / handle.getframerate()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--alignment", type=Path, required=True)
    parser.add_argument("--audio", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--test-id", required=True)
    parser.add_argument("--language", required=True)
    parser.add_argument("--source-audio", required=True)
    parser.add_argument("--aligner-version", default="MFA Docker image: mmcauliffe/montreal-forced-aligner@sha256:1986960fcb5169979630a7efb2576480c587500ab556c9daa66a930f471215b8")
    parser.add_argument("--acoustic-model", default="MFA pretrained acoustic model")
    parser.add_argument("--dictionary-model", default=None)
    parser.add_argument("--g2p-model", default=None)
    parser.add_argument("--interpolation-ms", type=float, default=70)
    args = parser.parse_args()

    duration = wav_duration(args.audio)
    timeline = build_timeline(
        test_id=args.test_id,
        language=args.language,
        source_audio=args.source_audio,
        audio_duration=duration,
        aligner="Montreal Forced Aligner",
        aligner_version=args.aligner_version,
        acoustic_model=args.acoustic_model,
        dictionary_model=args.dictionary_model,
        g2p_model=args.g2p_model,
        phone_intervals=parse_mfa_json(args.alignment),
        interpolation_ms=args.interpolation_ms,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(timeline, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({
        "test_id": args.test_id,
        "language": args.language,
        "audio_duration": duration,
        "timeline_duration": timeline["duration"],
        "phone_count": len(timeline["keyframes"]),
        "output": str(args.output),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
