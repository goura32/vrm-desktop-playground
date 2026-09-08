#!/usr/bin/env python3
"""Compare the bounded linear interpolation settings used by the PoC."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

MOUTHS = ("aa", "ih", "ou", "ee", "oh")


def full_weights(frame: dict) -> dict[str, float]:
    return {mouth: float(frame.get("weights", {}).get(mouth, 0.0)) for mouth in MOUTHS}


def sample(timeline: dict, time: float, interpolation_ms: float) -> dict[str, float]:
    duration = float(timeline["duration"])
    if time >= duration:
        return {mouth: 0.0 for mouth in MOUTHS}
    frames = timeline["keyframes"]
    if time < frames[0]["time"]:
        return full_weights(frames[0])
    right_index = next((index for index, frame in enumerate(frames) if frame["time"] >= time), len(frames) - 1)
    if right_index == 0:
        return full_weights(frames[0])
    right = frames[right_index]
    left = frames[right_index - 1]
    left_weights = full_weights(left)
    right_weights = full_weights(right)
    window = max(0.0, interpolation_ms) / 1000.0
    if window == 0 or right["time"] == left["time"]:
        return right_weights if right["time"] == time else left_weights
    start = right["time"] - window / 2
    end = right["time"] + window / 2
    if time < start:
        return left_weights
    if time > end:
        return right_weights
    amount = min(1.0, max(0.0, (time - start) / window))
    return {mouth: left_weights[mouth] + (right_weights[mouth] - left_weights[mouth]) * amount for mouth in MOUTHS}


def compare(timeline: dict, interpolation_ms: float, refresh_hz: float) -> dict[str, float | int]:
    step = 1.0 / refresh_hz
    previous = None
    deltas: list[float] = []
    overlap_samples = 0
    sample_count = math.ceil(float(timeline["duration"]) * refresh_hz)
    for index in range(sample_count + 1):
        weights = sample(timeline, min(float(timeline["duration"]), index * step), interpolation_ms)
        if sum(value > 0.05 for value in weights.values()) >= 2:
            overlap_samples += 1
        if previous is not None:
            deltas.append(max(abs(weights[mouth] - previous[mouth]) for mouth in MOUTHS))
        previous = weights
    return {
        "interpolation_ms": interpolation_ms,
        "max_frame_weight_delta": round(max(deltas, default=0.0), 6),
        "mean_frame_weight_delta": round(sum(deltas) / len(deltas), 6) if deltas else 0.0,
        "overlap_samples": overlap_samples,
        "sample_count": sample_count + 1,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("timeline", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--refresh-hz", type=float, default=60)
    args = parser.parse_args()
    timeline = json.loads(args.timeline.read_text(encoding="utf-8"))
    report = {
        "test_id": timeline.get("testId"),
        "duration": timeline["duration"],
        "settings": [compare(timeline, value, args.refresh_hz) for value in (0, 40, 70, 100)],
    }
    rendered = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
    print(rendered, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
