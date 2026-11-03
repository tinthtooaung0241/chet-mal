import { Scalar, UniversalCamera, Vector3, type Scene } from "@babylonjs/core";

const EYE_HEIGHT = 1.55;
const MOUSE_SENSITIVITY = 0.0025;
const TURN_SPEED = 2.4; // rad/s for keyboard turning
const MIN_PITCH = -0.6;
const MAX_PITCH = 1.1;

/** First-person camera at the chef's eyes. Mouse look via pointer lock, or arrow keys to turn. */
export class PovController {
  readonly camera: UniversalCamera;
  yaw = 0;
  /** positive looks down; start tilted towards the counters */
  pitch = 0.4;

  constructor(
    scene: Scene,
    private readonly canvas: HTMLCanvasElement,
  ) {
    this.camera = new UniversalCamera("pov", new Vector3(0, EYE_HEIGHT, 0), scene);
    this.camera.inputs.clear(); // we drive it ourselves from game state
    this.camera.minZ = 0.03;
    this.camera.fov = 1.1;

    document.addEventListener("mousemove", (e) => {
      if (document.pointerLockElement !== canvas || this.frozen) return;
      this.yaw += e.movementX * MOUSE_SENSITIVITY;
      this.pitch = Scalar.Clamp(this.pitch + e.movementY * MOUSE_SENSITIVITY, MIN_PITCH, MAX_PITCH);
    });
  }

  /** the mouse is busy elsewhere (choosing a sign): don't turn the view */
  frozen = false;

  get active(): boolean {
    return this.camera.getScene().activeCamera === this.camera;
  }

  lockPointer() {
    if (document.pointerLockElement !== this.canvas) void this.canvas.requestPointerLock?.();
  }

  turn(direction: number, dt: number) {
    this.yaw += direction * TURN_SPEED * dt;
  }

  sync(x: number, z: number) {
    this.yaw = Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw));
    this.camera.position.set(x, EYE_HEIGHT, z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  /** World position for something held in the chef's hands, low and to the right of view. */
  handPosition(): Vector3 {
    return Vector3.TransformCoordinates(new Vector3(0.15, -0.24, 0.5), this.camera.computeWorldMatrix());
  }
}
