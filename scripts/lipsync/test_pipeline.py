#!/usr/bin/env python3
import json
import unittest

from lipsync_pipeline import build_timeline, map_phone, validate_timeline


class LipSyncPipelineTests(unittest.TestCase):
    def test_mouth_mapping_and_diphthong(self):
        self.assertEqual(map_phone('a')['weights'], {'aa': 1.0, 'ih': 0.0, 'ou': 0.0, 'ee': 0.0, 'oh': 0.0})
        self.assertEqual(map_phone('sil')['dominant_mouth'], None)
        self.assertEqual(map_phone('aɪ')['transition'], ['aa', 'ih'])
        self.assertEqual(map_phone('aj')['transition'], ['aa', 'ih'])
        self.assertEqual(map_phone('aw')['transition'], ['aa', 'ou'])
        self.assertEqual(map_phone('ow')['transition'], ['oh', 'ou'])

    def test_timeline_has_bounded_weights_and_duration(self):
        timeline = build_timeline(
            test_id='UNIT',
            language='English',
            source_audio='UNIT.wav',
            audio_duration=1.0,
            aligner='MFA',
            aligner_version='3.4.3',
            acoustic_model='english_mfa',
            phone_intervals=[(0.1, 0.4, 'a'), (0.4, 0.6, 'sil')],
            interpolation_ms=70,
        )
        validate_timeline(timeline)
        self.assertEqual(timeline['duration'], 1.0)
        self.assertTrue(all(0 <= value <= 1 for frame in timeline['keyframes'] for value in frame['weights'].values()))
        self.assertTrue(any(frame.get('sourcePhone') == 'sil' for frame in timeline['keyframes']))


if __name__ == '__main__':
    unittest.main()
