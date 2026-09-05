import { VRMExpression, VRMExpressionManager } from '@pixiv/three-vrm-core';
import type { VRM } from '@pixiv/three-vrm';
import { describe, expect, it } from 'vitest';
import { ExpressionController } from '../src/renderer/vrm/ExpressionController';

function createTestVrm(): VRM {
  const manager = new VRMExpressionManager();
  manager.registerExpression(new VRMExpression('aa'));
  manager.registerExpression(new VRMExpression('blink'));
  manager.registerExpression(new VRMExpression('customWink'));
  return { expressionManager: manager } as unknown as VRM;
}

describe('ExpressionController', () => {
  it('reports preset and custom expression values and updates a known expression', () => {
    const vrm = createTestVrm();
    const controller = new ExpressionController(vrm);

    expect(controller.expressionInfos).toEqual([
      { name: 'aa', kind: 'preset', value: 0, supported: true },
      { name: 'blink', kind: 'preset', value: 0, supported: true },
      { name: 'customWink', kind: 'custom', value: 0, supported: true },
    ]);
    expect(controller.setValue('aa', 0.75)).toBe(true);
    expect(vrm.expressionManager?.getValue('aa')).toBe(0.75);
    expect(controller.setValue('missing', 1)).toBe(false);
  });

  it('handles unsupported blinking without throwing', () => {
    const manager = new VRMExpressionManager();
    const controller = new ExpressionController({ expressionManager: manager } as unknown as VRM);
    expect(controller.blink()).toBe(false);
  });

  it('reports unsupported expressions when the VRM has no expression manager', () => {
    const controller = new ExpressionController({} as VRM);
    expect(controller.hasExpression('blink')).toBe(false);
    expect(controller.blink()).toBe(false);
  });
});
