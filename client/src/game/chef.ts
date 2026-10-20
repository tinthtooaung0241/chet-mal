// A chef on screen, animated procedurally from game state so teammates can read each other:
// a real walk cycle (feet planted to the distance travelled), the head following where the
// player looks and glancing at what they work on, elbows that bend for carrying, chopping,
// stirring and every emote, a knife in hand while chopping, and blinking eyes.
// Built from the Blender characters, split into pieces that pivot at their joints.
import {
  Axis,
  Color3,
  MeshBuilder,
  Quaternion,
  Scalar,
  StandardMaterial,
  TransformNode,
  Vector3,
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
const FOREARM = 0.275; // elbow to palm, in model units

// Rotation signs for the converted glTF joints (checked in the browser): a negative X turn
// swings a hanging limb forward; a positive X turn tips the torso/head forward.
const FWD = -1;
const TILT = 1;

type JointName = "torso" | "head" | "eyes" | "armL" | "armR" | "foreL" | "foreR" | "legL" | "legR";

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
  stirring: boolean;
  gesture: Chef["gesture"];
  guided: boolean;
  guiding: boolean;
  /** the station this chef is facing, to glance at */
  look: { x: number; z: number } | null;
  /** customers: seated at a table, and eating */
  sitting?: boolean;
  eating?: boolean;
}

/** Lowers the body onto a chair seat (hips at ~0.48 m) with the legs out under the table. */
const SIT_DROP = 0.38;

export class ChefModel {
  readonly root: TransformNode;
  private readonly bob: TransformNode;
  private readonly joints: Partial<Record<JointName, Joint>> = {};
  private knife: TransformNode | null = null;
  private phase = 0;
  private speed = 0;
  private turnRate = 0;
  private lastStep = 0;
  private nextBlink = 2 + Math.random() * 3;
  private sit = 0;
  private blink = 0;
  /** called on each footfall with the foot's world position */
  onStep: ((x: number, z: number) => void) | null = null;

  /** @param modelName another character to animate the same way (the customers) */
  constructor(scene: Scene, shadows: ShadowGenerator, lib: AssetLibrary, role: Role, apronColor: Color3, modelName?: string) {
    this.root = new TransformNode("chef", scene);
    this.bob = new TransformNode("chefBob", scene);
    this.bob.parent = this.root;
    const model = modelName ?? CHEF_MODELS[role];
    if (!lib.has(model)) {
      this.placeholder(scene, shadows, apronColor);
      return;
    }
    const node = lib.spawn(model);
    node.parent = this.bob;
    node.scaling.setAll(CHEF_SCALE);
    for (const mesh of node.getChildMeshes(false)) shadows.addShadowCaster(mesh);
    const parts: Record<string, JointName> = {
      Torso: "torso",
      Head: "head",
      Eyes: "eyes",
      ArmL: "armL",
      ArmR: "armR",
      ForearmL: "foreL",
      ForearmR: "foreR",
      LegL: "legL",
      LegR: "legR",
    };
    for (const child of node.getDescendants(false)) {
      if (!(child instanceof TransformNode)) continue;
      const suffix = Object.keys(parts).find((s) => child.name.endsWith(`_${s}`));
      if (!suffix) continue;
      child.rotationQuaternion ??= Quaternion.FromEulerVector(child.rotation);
      this.joints[parts[suffix]] = { node: child, rest: child.rotationQuaternion.clone() };
    }

    // a knife that appears in the right hand while chopping
    const hand = this.joints.foreR?.node;
    if (hand && lib.has("Knife")) {
      const knife = lib.spawn("Knife");
      knife.parent = hand;
      knife.position.set(0, -FOREARM + 0.01, 0.02);
      knife.rotation.set(Math.PI / 2, -Math.PI / 2, 0); // blade forward out of the fist
      knife.scaling.setAll(1.15);
      knife.setEnabled(false);
      this.knife = knife;
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

  /** Where carried food should sit: between the palms (null without a character model). */
  carryPoint(): Vector3 | null {
    const l = this.joints.foreL?.node;
    const r = this.joints.foreR?.node;
    if (!l || !r) return null;
    const palm = new Vector3(0, -FOREARM, 0.02);
    const pl = Vector3.TransformCoordinates(palm, l.getWorldMatrix());
    const pr = Vector3.TransformCoordinates(palm, r.getWorldMatrix());
    return pl.addInPlace(pr).scaleInPlace(0.5);
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
    const foreL = zero();
    const foreR = zero();
    const legL = zero();
    const legR = zero();

    // --- base: walk / idle ---
    legL.x = FWD * sin * 0.55 * walk;
    legR.x = -FWD * sin * 0.55 * walk;
    armL.x = -FWD * sin * 0.45 * walk;
    armR.x = FWD * sin * 0.45 * walk;
    armL.z = 0.06;
    armR.z = -0.06;
    // relaxed elbows, bending a bit more on the forward swing
    foreL.x = FWD * (0.15 + 0.25 * walk + Math.max(0, -sin) * 0.3 * walk);
    foreR.x = FWD * (0.15 + 0.25 * walk + Math.max(0, sin) * 0.3 * walk);
    torso.x = TILT * 0.1 * walk;
    torso.y = sin * 0.08 * walk;
    torso.z = Math.sin(this.phase * 2) * 0.02 * walk;
    const breathe = Math.sin(time * 2.1) * (1 - walk);
    torso.x += TILT * breathe * 0.012;
    this.bob.position.y = Math.abs(Math.cos(this.phase)) * 0.035 * walk;
    this.sit = Scalar.Lerp(this.sit, s.sitting ? 1 : 0, Math.min(1, dt * 6));
    if (this.sit > 0.01) {
      this.bob.position.y -= SIT_DROP * this.sit;
      legL.x = legR.x = FWD * 1.45 * this.sit;
      torso.x -= TILT * 0.05 * this.sit;
      // hands rest on the table edge
      armL.x = armR.x = FWD * 0.35 * this.sit;
      foreL.x = foreR.x = FWD * 0.9 * this.sit;
    }
    if (s.eating) {
      // fork up to the mouth, chew, back down to the plate
      const bite = Math.max(0, Math.sin(time * 2.4));
      armR.x = FWD * (0.45 + 0.55 * bite);
      foreR.x = FWD * (1.0 + 1.1 * bite);
      head.x += TILT * (0.2 - 0.15 * bite);
    }
    // the head follows where the player is looking (others can see what you look at)
    head.x = TILT * Scalar.Clamp(s.pitch * 0.75, -0.45, 0.6);
    // ...and glances at the station in front when standing at it
    if (s.look && walk < 0.3) {
      const want = Math.atan2(s.look.x - root.position.x, s.look.z - root.position.z);
      let rel = want - root.rotation.y;
      rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      head.y = Scalar.Clamp(rel, -0.5, 0.5) * 0.7;
      head.x += TILT * 0.15;
    }

    // --- holding hands ---
    if (s.guided) {
      armR.x = FWD * 0.85; // reaching for the guide
      foreR.x = FWD * 0.2;
    }
    if (s.guiding) {
      armL.x = -FWD * 0.45; // hand held back for the one following
      foreL.x = FWD * 0.1;
    }

    // --- carrying: hands out in front at waist height ---
    if (s.holding) {
      armL.x = armR.x = FWD * (0.55 + sin * 0.05 * walk);
      foreL.x = foreR.x = FWD * 1.05;
      armL.z = 0.16;
      armR.z = -0.16;
    }

    // --- stirring the soup pot ---
    if (s.stirring && !s.holding) {
      const c = time * 4;
      armR.x = FWD * (0.75 + Math.sin(c) * 0.12);
      armR.z = -0.12 + Math.cos(c) * 0.12;
      foreR.x = FWD * (0.95 + Math.cos(c) * 0.15);
      torso.x += TILT * 0.08;
      head.x += TILT * 0.25;
    }

    // --- chopping: lean in, other hand steadies the food, knife hand chops from the elbow ---
    if (s.chopping) {
      torso.x = TILT * 0.16;
      head.x = TILT * 0.45;
      armL.x = FWD * 0.6;
      foreL.x = FWD * 1.1;
      armL.z = 0.2;
      armR.x = FWD * 0.65;
      foreR.x = FWD * (0.75 + (Math.sin(time * 22) * 0.5 + 0.5) * 0.7);
      armR.z = -0.12;
    }
    this.knife?.setEnabled(s.chopping);

    // --- gestures (actions and emotes), eased in and out ---
    const g = s.gesture;
    if (g) {
      const p = 1 - g.ttl / g.total;
      const env = Math.sin(Math.PI * Scalar.Clamp(p, 0, 1));
      const wave = (hz: number) => Math.sin(p * Math.PI * 2 * hz);
      const both = (upper: number, fore: number) => {
        armL.x = armR.x = FWD * upper;
        foreL.x = foreR.x = FWD * fore;
      };
      switch (g.kind) {
        case "pickup":
        case "place":
          torso.x += TILT * 0.35 * env;
          head.x += TILT * 0.25 * env;
          both(0.5 + 0.5 * env, 0.6 + 0.3 * env);
          break;
        case "trash":
          torso.y += 0.35 * env;
          armR.x = FWD * 1.0 * env;
          foreR.x = FWD * 0.5 * env;
          break;
        case "serve":
        case "give":
          torso.x += TILT * 0.15 * env;
          both(0.7 + 0.5 * env, 0.9 - 0.6 * env); // arms extend to pass it over
          break;
        case "receive":
          both(0.6 + 0.4 * env, 1.1 - 0.3 * env);
          break;
        case "sniff":
          torso.x += TILT * 0.2 * env;
          head.x += TILT * (0.4 * env + wave(3) * 0.05);
          armR.x = FWD * 0.9 * env; // bring it up to the nose
          foreR.x = FWD * 2.1 * env;
          armR.z = -0.25 * env;
          break;
        case "ping":
          armR.x = FWD * 1.5 * env; // arm straight out, pointing
          foreR.x = FWD * 0.05;
          head.x = TILT * 0.1;
          break;
        case "bell":
          armR.x = FWD * 0.7 * env;
          foreR.x = FWD * (0.6 + Math.max(0, wave(2)) * 0.5) * env; // tapping the bell
          head.x += TILT * 0.15 * env;
          break;
        case "hand":
          armR.x = FWD * 0.9 * env;
          foreR.x = FWD * 0.3 * env;
          break;
        case "season":
          // hold the dish in the left hand and shake the right over it
          armL.x = FWD * 0.6;
          foreL.x = FWD * 1.1;
          armR.x = FWD * (0.95 + wave(4) * 0.12) * env;
          foreR.x = FWD * (1.25 + wave(8) * 0.25) * env;
          armR.z = -0.1;
          head.x += TILT * 0.3 * env;
          break;
        case "yes":
          head.x += TILT * wave(3) * 0.32 * env;
          break;
        case "no":
          head.y += wave(3) * 0.5 * env;
          break;
        case "here":
          armR.x = FWD * (1.0 + wave(4) * 0.12) * env; // jabbing at the spot
          foreR.x = FWD * 0.15;
          head.x += TILT * 0.25 * env;
          break;
        case "hurry":
          // both arms up, forearms beckoning
          armL.x = armR.x = FWD * 1.1 * env;
          foreL.x = FWD * (0.8 + wave(5) * 0.6) * env;
          foreR.x = FWD * (0.8 - wave(5) * 0.6) * env;
          break;
        case "stop":
          armR.x = FWD * 1.6 * env; // palm out like a traffic warden
          foreR.x = FWD * 1.4 * env;
          armR.z = -0.15 * env;
          break;
        case "done":
          armL.x = armR.x = FWD * 2.9 * env; // both arms up
          foreL.x = foreR.x = FWD * 0.15 * env;
          armL.z = 0.35 * env;
          armR.z = -0.35 * env;
          head.x -= TILT * 0.2 * env;
          break;
      }
    }

    // --- blinking ---
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blink = 0.14;
      this.nextBlink = 2 + Math.random() * 4;
    }
    this.blink = Math.max(0, this.blink - dt);
    const eyes = this.joints.eyes?.node;
    if (eyes) eyes.scaling.y = this.blink > 0 ? 0.12 : 1;

    const rate = Math.min(1, dt * 16);
    this.apply("torso", torso, rate);
    this.apply("head", head, rate);
    this.apply("armL", armL, rate);
    this.apply("armR", armR, rate);
    this.apply("foreL", foreL, rate);
    this.apply("foreR", foreR, rate);
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
