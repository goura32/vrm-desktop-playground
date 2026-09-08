"""Pure MFA-phone to VRM 1.0 five-mouth timeline helpers.

The module deliberately has no third-party dependencies so it can be used by
CI and by the offline preprocessing scripts without the Qwen/MFA environment.
"""

from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any, Iterable

MOUTHS = ("aa", "ih", "ou", "ee", "oh")
SILENCE = {"", "sil", "sp", "spn", "pau", "silence", "<eps>"}
EXACT = {
    "a": "aa", "aː": "aa", "ɑ": "aa", "æ": "aa", "ɐ": "aa", "ʌ": "aa", "ɜ": "aa", "ɝ": "aa", "ɚ": "aa",
    "e": "ee", "eː": "ee", "ɛ": "ee", "ə": "aa", "ɨ": "ih", "ʉ": "ou",
    "ɪ": "ih", "i": "ih", "iː": "ih", "j": "ih", "y": "ih", "ʏ": "ih",
    "o": "oh", "oː": "oh", "ɔ": "oh", "ɔː": "oh", "ɒ": "oh", "ɤ": "oh",
    "u": "ou", "uː": "ou", "ʊ": "ou", "ɯ": "ou",
}
DIPHTHONGS = {
    "aɪ": ("aa", "ih"), "aʊ": ("aa", "ou"), "oʊ": ("oh", "ou"), "ɔɪ": ("oh", "ih"),
    "aj": ("aa", "ih"), "aw": ("aa", "ou"), "ow": ("oh", "ou"), "ɔj": ("oh", "ih"),
}
TONE_MARKS = re.compile(r"[˥˦˨˩˧¹²³⁴⁵]")
CONTROL_CHARACTERS = re.compile(r"[\u0000-\u001f\u007f-\u009f\u2028\u2029]")


def empty_weights() -> dict[str, float]:
    return {mouth: 0.0 for mouth in MOUTHS}


def _validate_text(value: Any, label: str, maximum: int, *, required: bool = True) -> None:
    if value is None and not required:
        return
    if not isinstance(value, str) or (required and not value) or len(value) > maximum or CONTROL_CHARACTERS.search(value):
        raise ValueError(f"invalid {label}")


def normalize_phone(phone: str) -> str:
    return TONE_MARKS.sub("", phone.strip().lower())


def _dominant(weights: dict[str, float]) -> str | None:
    best: str | None = None
    value = 0.0
    for mouth in MOUTHS:
        if weights[mouth] > value:
            best = mouth
            value = weights[mouth]
    return best


def _infer(phone: str) -> str | None:
    if any(char in phone for char in ("a", "ɑ", "æ")):
        return "aa"
    if any(char in phone for char in ("i", "ɪ", "j", "y")):
        return "ih"
    if any(char in phone for char in ("u", "ʊ", "ɯ")):
        return "ou"
    if any(char in phone for char in ("e", "ɛ")):
        return "ee"
    if any(char in phone for char in ("o", "ɔ", "ɤ")):
        return "oh"
    return None


def map_phone(phone: str) -> dict[str, Any]:
    normalized = normalize_phone(phone)
    if normalized in SILENCE:
        weights = empty_weights()
        return {"weights": weights, "dominant_mouth": None, "transition": None}
    if normalized in DIPHTHONGS:
        first, second = DIPHTHONGS[normalized]
        weights = empty_weights()
        weights[first] = 0.7
        weights[second] = 0.7
        return {"weights": weights, "dominant_mouth": first, "transition": [first, second]}
    mouth = EXACT.get(normalized) or _infer(normalized)
    if mouth is None:
        weights = empty_weights()
        return {"weights": weights, "dominant_mouth": None, "transition": None}
    weights = empty_weights()
    weights[mouth] = 1.0
    return {"weights": weights, "dominant_mouth": mouth, "transition": None}


def _single(mouth: str) -> dict[str, float]:
    weights = empty_weights()
    weights[mouth] = 1.0
    return weights


def _keyframe(time: float, weights: dict[str, float], phone: str) -> dict[str, Any]:
    return {
        "time": round(max(0.0, time), 6),
        "weights": {mouth: round(min(1.0, max(0.0, float(weights[mouth]))), 6) for mouth in MOUTHS},
        "sourcePhone": phone,
    }


def build_timeline(
    *,
    test_id: str,
    language: str,
    source_audio: str,
    audio_duration: float,
    aligner: str,
    aligner_version: str,
    acoustic_model: str,
    phone_intervals: Iterable[tuple[float, float, str]],
    interpolation_ms: float = 70,
    dictionary_model: str | None = None,
    g2p_model: str | None = None,
) -> dict[str, Any]:
    _validate_text(test_id, "test_id", 128)
    _validate_text(language, "language", 64)
    _validate_text(source_audio, "source_audio", 255)
    _validate_text(aligner, "aligner", 128)
    _validate_text(aligner_version, "aligner_version", 128)
    _validate_text(acoustic_model, "acoustic_model", 128)
    _validate_text(dictionary_model, "dictionary_model", 128, required=False)
    _validate_text(g2p_model, "g2p_model", 128, required=False)
    if not math.isfinite(audio_duration) or audio_duration <= 0:
        raise ValueError("audio_duration must be positive")
    if not math.isfinite(interpolation_ms) or interpolation_ms < 0 or interpolation_ms > 1000:
        raise ValueError("interpolation_ms must be finite and between 0 and 1000")
    intervals = sorted(
        (max(0.0, float(start)), min(audio_duration, float(end)), str(phone))
        for start, end, phone in phone_intervals
        if float(end) > 0 and float(start) < audio_duration and float(end) > float(start)
    )
    frames: list[dict[str, Any]] = []
    cursor = 0.0
    for start, end, phone in intervals:
        if start > cursor:
            frames.append(_keyframe(cursor, empty_weights(), "sil"))
            frames.append(_keyframe(start, empty_weights(), "sil"))
        mapped = map_phone(phone)
        transition = mapped["transition"]
        if transition:
            first, second = transition
            middle = start + (end - start) * 0.5
            frames.extend((_keyframe(start, _single(first), phone), _keyframe(middle, mapped["weights"], phone), _keyframe(end, _single(second), phone)))
        else:
            frames.extend((_keyframe(start, mapped["weights"], phone), _keyframe(end, mapped["weights"], phone)))
        cursor = max(cursor, end)
    if not frames or cursor < audio_duration:
        frames.append(_keyframe(cursor, empty_weights(), "sil"))
        frames.append(_keyframe(audio_duration, empty_weights(), "sil"))
    else:
        frames.append(_keyframe(audio_duration, empty_weights(), "sil"))

    deduplicated: list[dict[str, Any]] = []
    for frame in sorted(frames, key=lambda item: item["time"]):
        if deduplicated and frame["time"] == deduplicated[-1]["time"]:
            deduplicated[-1] = frame
        else:
            deduplicated.append(frame)
    timeline = {
        "version": 1,
        "testId": test_id,
        "language": language,
        "sourceAudio": source_audio,
        "aligner": aligner,
        "alignerVersion": aligner_version,
        "acousticModel": acoustic_model,
        "dictionaryModel": dictionary_model,
        "g2pModel": g2p_model,
        "duration": round(audio_duration, 6),
        "audioDuration": round(audio_duration, 6),
        "interpolationMs": float(interpolation_ms),
        "keyframes": deduplicated,
    }
    validate_timeline(timeline)
    return timeline


def validate_timeline(timeline: dict[str, Any]) -> None:
    if timeline.get("version") != 1:
        raise ValueError("invalid timeline metadata")
    _validate_text(timeline.get("language"), "language", 64)
    _validate_text(timeline.get("sourceAudio"), "sourceAudio", 255)
    _validate_text(timeline.get("aligner"), "aligner", 128)
    for field in ("testId", "alignerVersion", "acousticModel", "dictionaryModel", "g2pModel"):
        if field in timeline and timeline[field] is not None:
            _validate_text(timeline[field], field, 128)
    duration = timeline.get("duration")
    audio_duration = timeline.get("audioDuration")
    if not isinstance(duration, (int, float)) or not math.isfinite(duration) or duration <= 0:
        raise ValueError("invalid timeline duration")
    if not isinstance(audio_duration, (int, float)) or not math.isfinite(audio_duration) or audio_duration <= 0:
        raise ValueError("invalid audio duration")
    interpolation_ms = timeline.get("interpolationMs")
    if not isinstance(interpolation_ms, (int, float)) or not math.isfinite(interpolation_ms) or interpolation_ms < 0 or interpolation_ms > 1000:
        raise ValueError("invalid interpolation duration")
    previous = -1.0
    keyframes = timeline.get("keyframes")
    if not isinstance(keyframes, list) or not keyframes:
        raise ValueError("timeline must contain keyframes")
    for frame in keyframes:
        time = frame.get("time")
        if not isinstance(time, (int, float)) or not math.isfinite(time) or time < previous or time > duration:
            raise ValueError("keyframes must be sorted and bounded")
        previous = float(time)
        weights = frame.get("weights")
        if not isinstance(weights, dict) or set(weights) != set(MOUTHS):
            raise ValueError("keyframe must contain exactly the five VRM mouth weights")
        if any(not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0 or value > 1 for value in weights.values()):
            raise ValueError("keyframe weights must be finite and bounded")
        if "sourcePhone" in frame and frame["sourcePhone"] is not None:
            _validate_text(frame["sourcePhone"], "sourcePhone", 64)


def parse_mfa_json(path: Path) -> list[tuple[float, float, str]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    entries = data.get("tiers", {}).get("phones", {}).get("entries", [])
    if not isinstance(entries, list):
        raise ValueError(f"MFA phone tier missing from {path}")
    return [(float(entry[0]), float(entry[1]), str(entry[2])) for entry in entries if len(entry) >= 3 and str(entry[2]).strip()]
