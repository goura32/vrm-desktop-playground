#!/usr/bin/env python3
"""Generate one offline WAV with Qwen3-TTS CustomVoice.

This script intentionally lives outside the Electron/npm dependency graph. Run it
with the dedicated Python environment that contains qwen-tts and soundfile.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--text", default=None)
    parser.add_argument("--text-file", type=Path, default=None)
    parser.add_argument("--language", choices=("Japanese", "English", "Chinese"), required=True)
    parser.add_argument("--speaker", default="ono_anna")
    parser.add_argument("--model", default="Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice")
    parser.add_argument("--revision", default="85e237c12c027371202489a0ec509ded67b5e4b5")
    parser.add_argument("--device", default="cuda:0")
    parser.add_argument("--dtype", choices=("bfloat16", "float16", "float32"), default="bfloat16")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if (args.text is None) == (args.text_file is None):
        parser.error("provide exactly one of --text or --text-file")

    import soundfile as sf
    import torch
    from qwen_tts import Qwen3TTSModel

    text = args.text if args.text is not None else args.text_file.read_text(encoding="utf-8")
    dtype = getattr(torch, args.dtype)
    model = Qwen3TTSModel.from_pretrained(
        args.model,
        revision=args.revision,
        device_map=args.device,
        dtype=dtype,
    )
    wavs, sample_rate = model.generate_custom_voice(
        text=text,
        language=args.language,
        speaker=args.speaker,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    sf.write(args.output, wavs[0], sample_rate)
    print(json.dumps({
        "model": args.model,
        "revision": args.revision,
        "speaker": args.speaker,
        "language": args.language,
        "sample_rate": sample_rate,
        "duration_seconds": len(wavs[0]) / sample_rate,
        "output": str(args.output),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
