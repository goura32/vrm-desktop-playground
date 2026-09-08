import type { VRM } from '@pixiv/three-vrm';
import type { MouthWeights } from '../../shared/lipsync';
import { VRM_MOUTH_EXPRESSIONS } from '../../shared/lipsync';
import type { ExpressionInfo, VrmMouthOverride } from '../../shared/types';
import { buildExpressionInfos } from './vrmModelInfo';

const BLINK_EXPRESSIONS = ['blink', 'blinkLeft', 'blinkRight'];

function clamp(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

export class ExpressionController {
  private autoBlinkEnabled = true;
  private blinkRemaining = 0;
  private nextBlinkIn = 2.5;

  public constructor(private readonly vrm: VRM) {}

  public get expressionInfos(): ExpressionInfo[] {
    const manager = this.vrm.expressionManager;
    if (!manager) {
      return [];
    }

    const presetValues: Record<string, number> = {};
    for (const name of Object.keys(manager.presetExpressionMap)) {
      presetValues[name] = manager.getValue(name) ?? 0;
    }
    const customValues: Record<string, number> = {};
    for (const name of Object.keys(manager.customExpressionMap)) {
      customValues[name] = manager.getValue(name) ?? 0;
    }
    return buildExpressionInfos(presetValues, customValues);
  }

  public hasExpression(name: string): boolean {
    const expression = this.vrm.expressionManager?.getExpression(name);
    return expression !== null && expression !== undefined;
  }

  public setValue(name: string, value: number): boolean {
    const manager = this.vrm.expressionManager;
    if (!manager || !this.hasExpression(name)) {
      return false;
    }
    manager.setValue(name, clamp(value));
    return true;
  }

  public reset(): void {
    this.vrm.expressionManager?.resetValues();
  }

  public setAutoBlink(enabled: boolean): void {
    this.autoBlinkEnabled = enabled;
    if (!enabled) {
      this.clearBlink();
    }
  }

  public get autoBlink(): boolean {
    return this.autoBlinkEnabled;
  }

  public get isBlinking(): boolean {
    return this.blinkRemaining > 0;
  }

  public blink(): boolean {
    const supported = BLINK_EXPRESSIONS.filter((name) => this.hasExpression(name));
    if (supported.length === 0) {
      return false;
    }
    for (const name of supported) {
      this.setValue(name, 1);
    }
    this.blinkRemaining = 0.16;
    return true;
  }

  public applyMouthWeights(weights: MouthWeights): number {
    let missingExpressions = 0;
    for (const mouth of VRM_MOUTH_EXPRESSIONS) {
      if (!this.setValue(mouth, weights[mouth])) {
        missingExpressions += 1;
      }
    }
    return missingExpressions;
  }

  public get mouthOverride(): VrmMouthOverride {
    const manager = this.vrm.expressionManager;
    if (!manager) {
      return 'unknown';
    }
    let hasBlend = false;
    for (const expression of manager.expressions) {
      if ((expression.weight ?? 0) <= 0) {
        continue;
      }
      if (expression.overrideMouth === 'block') {
        return 'block';
      }
      if (expression.overrideMouth === 'blend') {
        hasBlend = true;
      }
    }
    return hasBlend ? 'blend' : 'none';
  }


  public update(delta: number): void {
    if (this.blinkRemaining > 0) {
      this.blinkRemaining -= Math.max(0, delta);
      if (this.blinkRemaining <= 0) {
        this.clearBlink();
      }
    }

    if (this.autoBlinkEnabled) {
      this.nextBlinkIn -= Math.max(0, delta);
      if (this.nextBlinkIn <= 0) {
        this.blink();
        this.nextBlinkIn = 2.5 + Math.random() * 3;
      }
    }
  }

  private clearBlink(): void {
    for (const name of BLINK_EXPRESSIONS) {
      if (this.hasExpression(name)) {
        this.setValue(name, 0);
      }
    }
    this.blinkRemaining = 0;
  }
}
