import type { MouthWeights, VrmMouth } from '../../../shared/lipsync';
import { createEmptyMouthWeights, VRM_MOUTH_EXPRESSIONS } from '../../../shared/lipsync';

export interface PhoneMouthMapping {
  weights: MouthWeights;
  dominantMouth: VrmMouth | null;
  transition: [VrmMouth, VrmMouth] | null;
}

const SILENCE_PHONES = new Set(['', 'sil', 'sp', 'spn', 'pau', 'silence', '<eps>']);
const EXACT_MOUTH: Record<string, VrmMouth> = {
  a: 'aa',
  'aː': 'aa',
  ɑ: 'aa',
  æ: 'aa',
  ɐ: 'aa',
  ʌ: 'aa',
  ɜ: 'aa',
  ɝ: 'aa',
  ɚ: 'aa',
  e: 'ee',
  'eː': 'ee',
  ɛ: 'ee',
  ə: 'aa',
  ɨ: 'ih',
  ʉ: 'ou',
  eɪ: 'ee',
  ɪ: 'ih',
  i: 'ih',
  'iː': 'ih',
  j: 'ih',
  y: 'ih',
  ʏ: 'ih',
  o: 'oh',
  'oː': 'oh',
  ɔ: 'oh',
  'ɔː': 'oh',
  ɒ: 'oh',
  ɤ: 'oh',
  u: 'ou',
  'uː': 'ou',
  ʊ: 'ou',
  ɯ: 'ou',
};

function normalizePhone(phone: string): string {
  return phone
    .trim()
    .toLowerCase()
    .replace(/[˥˦˨˩˧¹²³⁴⁵]/g, '');
}

function transitionWeights(first: VrmMouth, second: VrmMouth): MouthWeights {
  const weights = createEmptyMouthWeights();
  weights[first] = 0.7;
  weights[second] = 0.7;
  return weights;
}

function singleWeights(mouth: VrmMouth): MouthWeights {
  const weights = createEmptyMouthWeights();
  weights[mouth] = 1;
  return weights;
}

function dominantMouth(weights: MouthWeights): VrmMouth | null {
  let best: VrmMouth | null = null;
  let bestWeight = 0;
  for (const mouth of VRM_MOUTH_EXPRESSIONS) {
    if (weights[mouth] > bestWeight) {
      best = mouth;
      bestWeight = weights[mouth];
    }
  }
  return best;
}

export function mapPhoneToMouth(phone: string): PhoneMouthMapping {
  const normalized = normalizePhone(phone);
  if (SILENCE_PHONES.has(normalized)) {
    return { weights: createEmptyMouthWeights(), dominantMouth: null, transition: null };
  }

  const transitions: Record<string, [VrmMouth, VrmMouth]> = {
    aɪ: ['aa', 'ih'],
    aʊ: ['aa', 'ou'],
    oʊ: ['oh', 'ou'],
    ɔɪ: ['oh', 'ih'],
    aj: ['aa', 'ih'],
    aw: ['aa', 'ou'],
    ow: ['oh', 'ou'],
    ɔj: ['oh', 'ih'],
  };
  const transition = transitions[normalized];
  if (transition) {
    const weights = transitionWeights(...transition);
    return { weights, dominantMouth: transition[0], transition };
  }

  const mapped = EXACT_MOUTH[normalized] ?? inferMouth(normalized);
  if (!mapped) {
    return { weights: createEmptyMouthWeights(), dominantMouth: null, transition: null };
  }
  const weights = singleWeights(mapped);
  return { weights, dominantMouth: dominantMouth(weights), transition: null };
}

function inferMouth(phone: string): VrmMouth | null {
  if (phone.includes('a') || phone.includes('ɑ') || phone.includes('æ')) {
    return 'aa';
  }
  if (phone.includes('i') || phone.includes('ɪ') || phone.includes('j') || phone.includes('y')) {
    return 'ih';
  }
  if (phone.includes('u') || phone.includes('ʊ') || phone.includes('ɯ')) {
    return 'ou';
  }
  if (phone.includes('e') || phone.includes('ɛ')) {
    return 'ee';
  }
  if (phone.includes('o') || phone.includes('ɔ') || phone.includes('ɤ')) {
    return 'oh';
  }
  return null;
}
