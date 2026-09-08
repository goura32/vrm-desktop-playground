import { describe, expect, it } from 'vitest';
import { mapPhoneToMouth } from '../src/renderer/avatar/lipsync/PhoneToVrmMouthMapper';

function closeWeights(weights: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(weights).filter(([, value]) => value > 0));
}

describe('PhoneToVrmMouthMapper', () => {
  it('maps Japanese and cross-language vowel phones to the five VRM mouth presets', () => {
    expect(closeWeights(mapPhoneToMouth('a').weights)).toEqual({ aa: 1 });
    expect(closeWeights(mapPhoneToMouth('iː').weights)).toEqual({ ih: 1 });
    expect(closeWeights(mapPhoneToMouth('u˥').weights)).toEqual({ ou: 1 });
    expect(closeWeights(mapPhoneToMouth('eɪ').weights)).toEqual({ ee: 1 });
    expect(closeWeights(mapPhoneToMouth('oː').weights)).toEqual({ oh: 1 });
    expect(mapPhoneToMouth('aj').transition).toEqual(['aa', 'ih']);
    expect(mapPhoneToMouth('aw').transition).toEqual(['aa', 'ou']);
    expect(mapPhoneToMouth('ow').transition).toEqual(['oh', 'ou']);
  });

  it('keeps consonants and silence closed without inventing a sixth viseme', () => {
    expect(mapPhoneToMouth('m').weights).toEqual({ aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 });
    expect(mapPhoneToMouth('sil').weights).toEqual({ aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 });
    expect(mapPhoneToMouth('m').dominantMouth).toBeNull();
  });

  it('represents an English diphthong as a transition between standard mouth presets', () => {
    const mapped = mapPhoneToMouth('aɪ');
    expect(mapped.transition).toEqual(['aa', 'ih']);
    expect(mapped.weights.aa).toBeGreaterThan(0);
    expect(mapped.weights.ih).toBeGreaterThan(0);
    expect(Object.keys(mapped.weights)).toEqual(['aa', 'ih', 'ou', 'ee', 'oh']);
  });
});
