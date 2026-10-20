// A chef on screen, animated procedurally from game state so teammates can read each other:
// a real walk cycle (feet planted to the distance travelled), the head following where the
// player looks, and poses for every action and emote. Built from the Blender characters,
// which are split into Torso, Head, ArmL/R and LegL/R pieces that pivot at their joints.
import {
  Axis,
  Color3,
  MeshBuilder,
  Quaternion,
  Scalar,
  StandardMaterial,
  TransformNode,
  type Scene,
  type ShadowGenerator,
} from "@babylonjs/core";
import { CHEF_SPEED, type Chef, type Role } from "@kitchen/shared";
import type { AssetLibrary } from "../assets";

// Which Blender character plays each role ("all senses" practice uses the mute chef's model).
const CHEF_MODELS: Record<Role, string> = {
  full: "Chef_Mute",
  blind: "Chef_Blind",
  deaf: "Chef_Deaf",
  mute: "Chef_Mute",
};
const CHEF_SCALE = 0.95;
const STRIDE = 1.1; // metres travelled per full walk cycle (two steps)

// Rotation signs for the converted glTF joints (checked in the browser): a negative X turn
// swings a hanging limb forward; a positive X turn tips the torso/head forward.
const FORWARD_LIMB = -1;
const FORWARD_TILT = 1;

type JointName = "torso" | "head" | "armL" | "armR" | "legL" | "legR";

interface Joint {
  node: TransformNode;
  rest: Quaternion;
}

/** Target rotation for one joint this frame (radians around its own axes). */
interface Pose {
  x: number;
  y: number;
  z: number;
}

const zero = (): Pose => ({ x: 0, y: 0, z: 0 });

export interface ChefState {
  x: number;
  z: number;
  facing: number;
  pitch: number;
  chopping: boolean;
  holding: boolean;
  gesture: Chef["gesture"];
  guided: boolean;
  guiding: boolean;
}

export class ChefModel {
  readonly root: TransformNode;
  private readonly bob: TransformNode;
  private readonly joints: Partial<Record<JointName, Joint>> = {};
  private phase = 0;
  private speed = 0;
  private turnRate = 0;
  private lastStep = 0;
  /** called on each footfall with the foot's world position */
  onStep: ((x: number, z: number) => void) | null = null;

  constructor(scene: Scene, shadows: ShadowGenerator, lib: AssetLibrary, role: Role, apronColor: Color3) {
    this.root = new TransformNode("chef", scene);
    this.bob = new TransformNode("chefBob", scene);
    this.bob.parent = this.root;
    const model = CHEF_MODELS[role];
    if (!lib.has(model)) {
      this.placeholder(scene, shadows, apronColor);
      return;
    }
    const node = lib.spawn(model);
    node.parent = this.bob;
    node.scaling.setAll(CHEF_SCALE);
    for (const mesh of node.getChildMeshes(false)) shadows.addShadowCaster(mesh);
    const parts = { Torso: "torso", Head: "head", ArmL: "armL", ArmR: "armR", LegL: "legL", LegR: "legR" } as const;
    for (const child of node.getDescendants(false)) {
      if (!(child instanceof TransformNode)) continue;
      const part = Object.entries(parts).find(([suffix]) => child.name.endsWith(`_${suffix}`));
      if (!part) continue;
      child.rotationQuaternion ??= Quaternion.FromEulerVector(child.rotation);
      this.joints[part[1]] = { node: child, rest: child.rotationQuaternion.clone() };
    }
  }

  /** Simple stand-in if a character model is missing. */
  private placeholder(scene: Scene, shadows: ShadowGenerator, apronColor: Color3) {
    const mat = new StandardMaterial("chefPlaceholder", scene);
    mat.diffuseColor = apronColor;
    const body = MeshBuilder.CreateCapsule("placeholder", { height: 1.7, radius: 0.25 }, scene);
    body.position.y = 0.85;
    body.material = mat;
    body.parent = this.bob;
    shadows.addShadowCaster(body);
  }

  /** @param smooth true for other players' chefs: glide between network snapshots */
  update(s: ChefState, dt: number, time: number, smooth: boolean) {
    if (dt <= 0) return;
    const root = this.root;
    const px = root.position.x;
    const pz = root.position.z;
    const follow = smooth ? Math.min(1, dt * 12) : 1;
    root.position.x += (s.x - px) * follow;
    root.position.z += (s.z - pz) * follow;
    const moved = Math.hypot(root.position.x - px, root.position.z - pz);

    // turn smoothly along the shortest arc
    let diff = s.facing - root.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const turn = diff * Math.min(1, dt * 14);
    root.rotation.y += turn;
    this.turnRate = Scalar.Lerp(this.turnRate, Math.abs(turn) / dt, Math.min(1, dt * 10));

    // walk cycle advances with distance, so feet don't slide; turning on the spot shuffles
    this.speed = Scalar.Lerp(this.speed, moved / dt, Math.min(1, dt * 10));
    const shuffle = this.speed < 0.3 && this.turnRate > 1.5 ? 0.35 : 0;
    this.phase += (moved / STRIDE) * Math.PI * 2 + shuffle * dt * 9;
    const walk = Math.max(Math.min(1, this.speed / CHEF_SPEED), shuffle);
    const step = Math.floor(this.phase / Math.PI);
    if (step !== this.lastStep) {
      this.lastStep = step;
      if (walk > 0.15 && this.onStep) {
        const side = step % 2 ? 1 : -1;
        const r = root.rotation.y;
        this.onStep(root.position.x + Math.cos(r) * 0.09 * side, root.position.z - Math.sin(r) * 0.09 * side);
      }
    }

    const sin = Math.sin(this.phase);
    const torso = zero();
    const head = zero();
    const armL = zero();
    const armR = zero();
    const legL = zero();
    const legR = zero();

    // --- base: walk / idle ---
    legL.x = FORWARD_LIMB * sin * 0.55 * walk;
    legR.x = -FORWARD_LIMB * sin * 0.55 * walk;
    armL.x = -FORWARD_LIMB * sin * 0.45 * walk;
    armR.x = FORWARD_LIMB * sin * 0.45 * walk;
    armL.z = 0.06;
    armR.z = -0.06;
    torso.x = FORWARD_TILT * 0.1 * walk;
    torso.y = sin * 0.08 * walk;
    torso.z = Math.sin(this.phase * 2) * 0.02 * walk;
    const breathe = Math.sin(time * 2.1) * (1 - walk);
    torso.x += FORWARD_TILT * breathe * 0.012;
    this.bob.position.y = Math.abs(Math.cos(this.phase)) * 0.035 * walk;
    // the head follows where the player is looking (others can see what you look at)
    head.x = FORWARD_TILT * Scalar.Clamp(s.pitch * 0.75, -0.45, 0.6);

    // --- holding hands ---
    if (s.guided) armR.x = FORWARD_LIMB * 0.9; // reaching for the guide
    if (s.guiding) armL.x = -FORWARD_LIMB * 0.45; // hand held back for the one following

    // --- carrying ---
    if (s.holding) {
      armL.x = armR.x = FORWARD_LIMB * (1.25 + sin * 0.06 * walk);
      armL.z = 0.12;
      armR.z = -0.12;
    }

    // --- chopping: lean in, eyes on the board, knife hand going ---
    if (s.chopping) {
      torso.x = FORWARD_TILT * 0.18;
      head.x = FORWARD_TILT * 0.4;
      armL.x = FORWARD_LIMB * 1.05;
      armR.x = FORWARD_LIMB * (1.0 + Math.sin(time * 22) * 0.35);
    }

    // --- gestures (actions and emotes), eased in and out ---
    const g = s.gesture;
    if (g) {
      const p = 1 - g.ttl / g.total;
      const env = Math.sin(Math.PI * Scalar.Clamp(p, 0, 1));
      const wave = (hz: number) => Math.sin(p * Math.PI * 2 * hz);
      switch (g.kind) {
        case "pickup":
        case "place":
          torso.x += FORWARD_TILT * 0.35 * env;
          head.x += FORWARD_TILT * 0.25 * env;
          armL.x = armR.x = FORWARD_LIMB * (0.6 + 0.4 * env) * (s.holding || g.kind === "place" ? 1.3 : 1);
          break;
        case "trash":
          torso.y += 0.35 * env;
          armR.x = FORWARD_LIMB * 1.4 * env;
          break;
        case "serve":
        case "give":
          torso.x += FORWARD_TILT * 0.15 * env;
          armL.x = armR.x = FORWARD_LIMB * (1.25 + 0.3 * env);
          break;
        case "receive":
          armL.x = armR.x = FORWARD_LIMB * 1.3 * env;
          break;
        case "sniff":
          torso.x += FORWARD_TILT * 0.2 * env;
          head.x += FORWARD_TILT * (0.45 * env + wave(3) * 0.05);
          armR.x = FORWARD_LIMB * 2.3 * env; // hand up near the nose
          armR.z = -0.35 * env;
          break;
        case "ping":
          armR.x = FORWARD_LIMB * 1.6 * env; // pointing straight ahead
          head.x = FORWARD_TILT * 0.1;
          break;
        case "bell":
          armR.x = FORWARD_LIMB * (0.95 + Math.max(0, wave(2)) * 0.25) * env;
          head.x += FORWARD_TILT * 0.15 * env;
          break;
        case "hand":
          armR.x = FORWARD_LIMB * 1.1 * env;
          break;
        case "yes":
          head.x += FORWARD_TILT * wave(3) * 0.32 * env;
          break;
        case "no":
          head.y += wave(3) * 0.5 * env;
          break;
        case "here":
          armR.x = FORWARD_LIMB * (1.1 + wave(4) * 0.18) * env; // jabbing at the spot
          head.x += FORWARD_TILT * 0.25 * env;
          break;
        case "hurry":
          armL.x = FORWARD_LIMB * (1.2 + wave(5) * 0.45) * env;
          armR.x = FORWARD_LIMB * (1.2 - wave(5) * 0.45) * env;
          break;
        case "stop":
          armR.x = FORWARD_LIMB * 2.4 * env; // palm up and out
          armR.z = -0.15 * env;
          break;
        case "done":
          armL.x = armR.x = FORWARD_LIMB * 2.9 * env; // both arms up
          armL.z = 0.35 * env;
          armR.z = -0.35 * env;
          head.x -= FORWARD_TILT * 0.2 * env;
          break;
      }
    }

    const rate = Math.min(1, dt * 16);
    this.apply("torso", torso, rate);
    this.apply("head", head, rate);
    this.apply("armL", armL, rate);
    this.apply("armR", armR, rate);
    this.apply("legL", legL, rate);
    this.apply("legR", legR, rate);
  }

  private apply(name: JointName, pose: Pose, rate: number) {
    const joint = this.joints[name];
    if (!joint) return;
    const target = joint.rest
      .multiply(Quaternion.RotationAxis(Axis.Y, pose.y))
      .multiply(Quaternion.RotationAxis(Axis.X, pose.x))
      .multiply(Quaternion.RotationAxis(Axis.Z, pose.z));
    joint.node.rotationQuaternion = Quaternion.Slerp(joint.node.rotationQuaternion!, target, rate);
  }
}
