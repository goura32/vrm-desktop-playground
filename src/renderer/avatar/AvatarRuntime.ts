import { VRMUtils } from '@pixiv/three-vrm';
import type { VRM } from '@pixiv/three-vrm';
import type { AvatarCommand, AvatarStatus, Capability, VrmModelInfo } from '../../shared/types';
import { ExpressionController } from '../vrm/ExpressionController';
import { LookAtController } from '../vrm/LookAtController';
import { MotionController } from '../vrm/MotionController';
import { parseVrm, parseVrma } from '../vrm/VrmLoader';
import { detectVrmFormat, toCapability } from '../vrm/vrmModelInfo';
import { SceneController } from '../scene/SceneController';
import { DEFAULT_CHARACTER_POSITION } from '../../shared/scenePosition';
import { shouldPublishMotionCompletion } from '../vrm/motionModel';

const EMPTY_STATUS: AvatarStatus = {
  phase: 'idle',
  message: 'Avatar renderer ready. Loading the bundled VRM sample…',
  model: null,
  motions: [],
  activeMotionId: null,
  playback: 'stopped',
  loop: true,
  speed: 1,
  autoBlink: true,
  manualBlink: false,
  lookAt: true,
  characterPosition: { ...DEFAULT_CHARACTER_POSITION },
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class AvatarRuntime {
  private readonly sceneController: SceneController;
  private readonly onStatus: (status: AvatarStatus) => void;
  private status = EMPTY_STATUS;
  private vrm: VRM | null = null;
  private expressionController: ExpressionController | null = null;
  private lookAtController: LookAtController | null = null;
  private motionController: MotionController | null = null;
  private modelFileName = '';
  private lookAtEnabled = true;
  private modelLoadRequestId = 0;
  private motionLoadRequestId = 0;
  private modelLoading = false;
  private motionLoading = false;

  public constructor(canvas: HTMLCanvasElement, onStatus: (status: AvatarStatus) => void) {
    this.sceneController = new SceneController(canvas);
    this.onStatus = onStatus;
    this.sceneController.start((delta) => this.update(delta));
  }

  public get currentStatus(): AvatarStatus {
    return this.status;
  }

  public handleCommand(command: AvatarCommand): void {
    switch (command.type) {
      case 'load-vrm':
        void this.loadVrm(command.file.name, command.file.data);
        break;
      case 'load-vrma':
        void this.loadVrma(command.file.name, command.file.data);
        break;
      case 'set-expression':
        this.setExpression(command.name, command.value);
        break;
      case 'reset-expressions':
        this.expressionController?.reset();
        this.publish({ model: this.vrm ? this.createModelInfo() : this.status.model, message: 'All expression weights reset to 0.' });
        break;
      case 'set-auto-blink':
        this.expressionController?.setAutoBlink(command.enabled);
        this.publish({ autoBlink: command.enabled, message: `Auto Blink ${command.enabled ? 'enabled' : 'disabled'}.` });
        break;
      case 'blink':
        this.blink();
        break;
      case 'set-look-at':
        this.lookAtEnabled = command.enabled;
        this.lookAtController?.setEnabled(command.enabled);
        this.publish({ lookAt: command.enabled, message: `LookAt ${command.enabled ? 'enabled' : 'disabled'}.` });
        break;
      case 'set-motion':
        this.setMotion(command.motionId);
        break;
      case 'motion-play':
        this.setMotionPlayback('play');
        break;
      case 'motion-pause':
        this.setMotionPlayback('pause');
        break;
      case 'motion-stop':
        this.setMotionPlayback('stop');
        break;
      case 'motion-set-loop':
        this.motionController?.setLoop(command.enabled);
        this.publishMotion(`Loop ${command.enabled ? 'enabled' : 'disabled'}.`);
        break;
      case 'motion-set-speed':
        this.motionController?.setSpeed(command.speed);
        this.publishMotion(`Motion speed set to ${this.motionController?.playbackSpeed.toFixed(1) ?? '1.0'}×.`);
        break;
      case 'set-character-position':
        this.setCharacterPosition(command.position);
        break;
      case 'move-character':
        this.moveCharacter(command.direction, command.step);
        break;
    }
  }

  public setLookAtTarget(normalizedX: number, normalizedY: number): void {
    this.lookAtController?.setNormalizedTarget(normalizedX, normalizedY);
  }

  public dispose(): void {
    this.modelLoadRequestId += 1;
    this.motionLoadRequestId += 1;
    this.modelLoading = false;
    this.motionLoading = false;
    this.motionController?.dispose();
    this.lookAtController?.dispose();
    if (this.vrm) {
      this.sceneController.removeModel(this.vrm);
      VRMUtils.deepDispose(this.vrm.scene);
    }
    this.sceneController.dispose();
  }

  private async loadVrm(fileName: string, data: ArrayBuffer): Promise<void> {
    const requestId = ++this.modelLoadRequestId;
    this.motionLoadRequestId += 1;
    this.modelLoading = true;
    this.motionLoading = false;
    const previousSources = this.motionController?.sourceFiles.map((source) => ({
      fileName: source.fileName,
      animations: [...source.animations],
    })) ?? [];
    const previousMotionId = this.motionController?.activeId;
    this.publish({ phase: 'loading', message: `Loading VRM 1.0 model: ${fileName}`, manualBlink: false });

    try {
      const vrm = await parseVrm(data);
      if (requestId !== this.modelLoadRequestId) {
        VRMUtils.deepDispose(vrm.scene);
        return;
      }
      this.motionController?.dispose();
      this.lookAtController?.dispose();
      if (this.vrm) {
        this.sceneController.removeModel(this.vrm);
        VRMUtils.deepDispose(this.vrm.scene);
      }
      this.vrm = vrm;
      this.modelFileName = fileName;
      this.expressionController = new ExpressionController(vrm);
      this.lookAtController = new LookAtController(vrm, this.sceneController.scene);
      this.lookAtController.setEnabled(this.lookAtEnabled);
      this.motionController = new MotionController(vrm);
      this.sceneController.setModel(vrm);
      for (const source of previousSources) {
        this.motionController.addSource(source);
      }
      if (previousMotionId) {
        this.motionController.selectMotion(previousMotionId);
      }
      this.modelLoading = false;
      this.publish({
        phase: 'ready',
        message: `Loaded VRM 1.0 model: ${fileName}`,
        model: this.createModelInfo(),
        motions: this.motionController.motionInfos,
        activeMotionId: this.motionController.activeId,
        playback: this.motionController.playbackState,
        loop: this.motionController.loopEnabled,
        speed: this.motionController.playbackSpeed,
        autoBlink: this.expressionController.autoBlink,
        characterPosition: this.sceneController.currentCharacterPosition,
      });
    } catch (error) {
      if (requestId !== this.modelLoadRequestId) {
        return;
      }
      this.modelLoading = false;
      this.publish({ phase: 'error', message: `VRM load failed: ${errorMessage(error)}` });
    }
  }

  private async loadVrma(fileName: string, data: ArrayBuffer): Promise<void> {
    if (!this.vrm || !this.motionController || this.modelLoading) {
      this.publish({ phase: 'error', message: 'Load a VRM model before loading a VRMA motion.' });
      return;
    }

    const targetVrm = this.vrm;
    const targetMotionController = this.motionController;
    const modelRequestId = this.modelLoadRequestId;
    const requestId = ++this.motionLoadRequestId;
    this.motionLoading = true;
    this.publish({ phase: 'loading', message: `Loading VRMA motion: ${fileName}` });
    try {
      const animations = await parseVrma(data);
      if (
        requestId !== this.motionLoadRequestId ||
        modelRequestId !== this.modelLoadRequestId ||
        this.vrm !== targetVrm ||
        this.motionController !== targetMotionController
      ) {
        return;
      }
      this.motionLoading = false;
      const added = targetMotionController.addAnimations(fileName, animations);
      if (added.length === 0) {
        throw new Error('No animation in the file is compatible with the current VRM humanoid.');
      }
      this.publishMotion(`Loaded ${added.length} motion${added.length === 1 ? '' : 's'} from ${fileName}.`);
    } catch (error) {
      if (
        requestId !== this.motionLoadRequestId ||
        modelRequestId !== this.modelLoadRequestId ||
        this.vrm !== targetVrm ||
        this.motionController !== targetMotionController
      ) {
        return;
      }
      this.motionLoading = false;
      this.publish({ phase: 'error', message: `VRMA load failed: ${errorMessage(error)}` });
    }
  }

  private setExpression(name: string, value: number): void {
    if (!this.expressionController) {
      this.publish({ phase: 'error', message: 'Load a VRM model before changing expressions.' });
      return;
    }
    if (!this.expressionController.setValue(name, value)) {
      this.publish({ message: `Expression “${name}” is unsupported by this model.` });
      return;
    }
    this.publish({ model: this.createModelInfo(), message: `Expression “${name}” set to ${Math.min(1, Math.max(0, value)).toFixed(2)}.` });
  }

  private blink(): void {
    if (!this.expressionController) {
      this.publish({ phase: 'error', message: 'Load a VRM model before blinking.' });
      return;
    }
    if (!this.expressionController.blink()) {
      this.publish({ message: 'Blink is unsupported by this model.' });
      return;
    }
    this.publish({ manualBlink: true, message: 'Manual blink triggered.' });
  }

  private setMotion(motionId: string): void {
    if (!this.motionController || !this.motionController.selectMotion(motionId)) {
      this.publish({ message: 'The selected motion is unsupported or unavailable.' });
      return;
    }
    this.publishMotion(`Selected motion ${motionId}.`);
  }

  private setMotionPlayback(action: 'play' | 'pause' | 'stop'): void {
    const controller = this.motionController;
    if (!controller) {
      this.publish({ message: 'Load a VRM and VRMA motion before using playback controls.' });
      return;
    }
    const changed = action === 'play' ? controller.play() : action === 'pause' ? controller.pause() : controller.stop();
    if (!changed) {
      this.publish({ message: `Motion ${action} is unsupported or no motion is selected.` });
      return;
    }
    const verb = action === 'play' ? 'played' : action === 'pause' ? 'paused' : 'stopped';
    this.publishMotion(`Motion ${verb}.`);
  }

  private setCharacterPosition(position: { x: number; y: number }): void {
    const next = this.sceneController.setCharacterPosition(position);
    this.publish({
      characterPosition: next,
      message: `Character position set to ${next.x.toFixed(2)}, ${next.y.toFixed(2)}.`,
    });
  }

  private moveCharacter(direction: 'up' | 'down' | 'left' | 'right', step: number): void {
    const next = this.sceneController.moveCharacter(direction, step);
    this.publish({
      characterPosition: next,
      message: `Character moved ${direction} to ${next.x.toFixed(2)}, ${next.y.toFixed(2)}.`,
    });
  }

  private publishMotion(message: string): void {
    const controller = this.motionController;
    this.publish({
      phase: this.vrm ? 'ready' : this.status.phase,
      message,
      motions: controller?.motionInfos ?? [],
      activeMotionId: controller?.activeId ?? null,
      playback: controller?.playbackState ?? 'stopped',
      loop: controller?.loopEnabled ?? true,
      speed: controller?.playbackSpeed ?? 1,
      model: this.vrm ? this.createModelInfo() : this.status.model,
    });
  }

  private update(delta: number): void {
    this.expressionController?.update(delta);
    const controller = this.motionController;
    const vrm = this.vrm;
    const modelRequestId = this.modelLoadRequestId;
    const motionRequestId = this.motionLoadRequestId;
    const loading = this.modelLoading || this.motionLoading;
    const previousPlayback = controller?.playbackState ?? this.status.playback;
    controller?.update(delta);
    const ownerIsCurrent =
      !loading &&
      !this.modelLoading &&
      !this.motionLoading &&
      this.vrm === vrm &&
      this.motionController === controller &&
      this.modelLoadRequestId === modelRequestId &&
      this.motionLoadRequestId === motionRequestId;
    if (controller && shouldPublishMotionCompletion(previousPlayback, controller.playbackState, loading, ownerIsCurrent)) {
      this.publishMotion('Motion finished.');
    }
    this.vrm?.update(delta);
    if (this.status.manualBlink && this.expressionController && !this.expressionController.isBlinking) {
      this.publish({ manualBlink: false });
    }
  }

  private createModelInfo(): VrmModelInfo | null {
    if (!this.vrm || !this.expressionController) {
      return null;
    }
    const manager = this.vrm.expressionManager;
    const presetExpressions = manager ? Object.keys(manager.presetExpressionMap) : [];
    const customExpressions = manager ? Object.keys(manager.customExpressionMap) : [];
    const humanoidBones = Object.keys(this.vrm.humanoid.humanBones).filter((name) => Boolean(this.vrm?.humanoid.humanBones[name as keyof typeof this.vrm.humanoid.humanBones]));
    const capabilities: Record<Capability, 'available' | 'unsupported'> = {
      humanoid: toCapability(humanoidBones.length > 0),
      presetExpressions: toCapability(presetExpressions.length > 0),
      customExpressions: toCapability(customExpressions.length > 0),
      blink: toCapability(['blink', 'blinkLeft', 'blinkRight'].some((name) => this.expressionController?.hasExpression(name))),
      lookAt: toCapability(Boolean(this.vrm.lookAt)),
      springBone: toCapability(Boolean(this.vrm.springBoneManager)),
      vrma: toCapability(humanoidBones.length > 0),
    };
    const metaName = 'name' in this.vrm.meta ? this.vrm.meta.name : this.vrm.meta.title;
    return {
      fileName: this.modelFileName,
      format: detectVrmFormat(this.vrm.meta.metaVersion),
      metaName: metaName || this.modelFileName,
      humanoidBones,
      expressions: this.expressionController.expressionInfos,
      capabilities,
    };
  }

  private publish(patch: Partial<AvatarStatus>): void {
    this.status = { ...this.status, ...patch };
    this.onStatus(this.status);
  }
}

export function getInitialAvatarStatus(): AvatarStatus {
  return { ...EMPTY_STATUS, characterPosition: { ...EMPTY_STATUS.characterPosition } };
}
