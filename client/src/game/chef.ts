// A chef on screen. Idle, walking, jogging and sitting play real animation clips (Quaternius'
// CC0 Universal Animation Library, baked to these joints in clips.json), blended by speed with
// the feet planted to the distance travelled. On top, driven from game state so teammates can
// read each other: the head following where the player looks and glancing at what they work on,
// arms for carrying, chopping, stirring and every emote, a knife while chopping, blinking eyes.
// Works on any skeleton with the game's joint names (Kenney's Animated Characters, renamed in
// Blender): poses are given in the character's own frame and carried into each bone's frame.
import {
  Axis,
  Color3,
  MeshBuilder,
  Quaternion,
  Scalar,
  StandardMaterial,
  TransformNode,
  Vector3,
  type Mesh,
  type Scene,
  type ShadowGenerator,
} from "@babylonjs/core";
import { CHEF_SPEED, type Chef, type ChefLook, type Role } from "@kitchen/shared";
import type { AssetLibrary } from "../assets";
import clipData from "./clips.json";

// Which Blender character plays each role ("all senses" practice uses the mute chef's model).
const CHEF_MODELS: Record<Role, string> = {
  full: "Chef_Mute",
  head: "Chef_Head",
  deaf: "Chef_Deaf",
  mute: "Chef_Mute",
};
const CHEF_SCALE = 0.95;
const WALK_STRIDE = 0.5; // metres travelled per full cycle (two steps), at this model's scale
const JOG_STRIDE = 1.9;
const FOREARM = 0.275; // elbow to palm, in model units

// Rotation signs for the converted glTF joints (checked in the browser): a negative X turn
// swings a hanging limb forward; a positive X turn tips the torso/head forward.
const FWD = -1;
const TILT = 1;

type JointName = "torso" | "head" | "eyes" | "armL" | "armR" | "foreL" | "foreR" | "legL" | "legR" | "shinL" | "shinR" | "footL" | "footR" | "hips" | "spine" | "handL" | "handR";

interface Clip {
  fps: number;
  frames: number;
  /** hip height against the T-pose's, as a fraction of it */
  hip: number[];
  /** per joint: x, y, z, w for each frame */
  bones: Partial<Record<JointName, number[]>>;
}
const CLIPS = clipData as unknown as Record<"Idle_Loop" | "Walk_Loop" | "Jog_Fwd_Loop" | "Sitting_Idle_Loop", Clip>;

const lerpLoop = (values: number[], t: number) => {
  const a = Math.floor(t) % values.length;
  return Scalar.Lerp(values[a], values[(a + 1) % values.length], t - Math.floor(t));
};

/** One joint's turn from a clip, at a position measured in frames. */
function clipTurn(clip: Clip, joint: JointName, t: number): Quaternion {
  const v = clip.bones[joint];
  if (!v) return Quaternion.Identity();
  const a = Math.floor(t) % clip.frames;
  const b = (a + 1) % clip.frames;
  const q = (i: number) => new Quaternion(v[i * 4], v[i * 4 + 1], v[i * 4 + 2], v[i * 4 + 3]);
  return Quaternion.Slerp(q(a), q(b), t - Math.floor(t));
}

interface Joint {
  node: TransformNode;
  rest: Quaternion;
  /** the joint's resting orientation in the character's frame (poses are given in that frame) */
  frame: Quaternion;
  frameInv: Quaternion;
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
  /** customers: seated at a table, and eating (with a fork, or a spoon for soups and noodles) */
  sitting?: boolean;
  eating?: boolean;
  utensil?: "fork" | "spoon";
  /** a spice bottle in the right hand (one-handed, unlike carrying a dish) */
  bottle?: boolean;
}

/** Lowers the body onto a chair seat (hips at ~0.48 m) with the legs out under the table. */
const SIT_DROP = 0.38;

export class ChefModel {
  readonly root: TransformNode;
  private readonly bob: TransformNode;
  private readonly joints: Partial<Record<JointName, Joint>> = {};
  private knife: TransformNode | null = null;
  /** a fork and a spoon for customers, in the right hand while they eat */
  private cutlery: { fork: TransformNode; spoon: TransformNode } | null = null;
  /** hand bones, on armatures that have them (where carried things and the knife go) */
  private hands: { l: TransformNode; r: TransformNode } | null = null;
  private phase = 0;
  private speed = 0;
  private turnRate = 0;
  private lastStep = 0;
  private nextBlink = 2 + Math.random() * 3;
  private sit = 0;
  /** 0 = the clip plays the arms, 1 = the game's own arm poses (carrying, chopping, emotes) */
  private armsBusy = 0;
  private hipHeight = 0.6;
  /** how far the body drops onto a chair: from this character's own hip height */
  private sitDrop = SIT_DROP;
  private blink = 0;
  /** the hat on the head (see setLook) */
  private hat: TransformNode | null = null;
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
      // the kit's own names for the lower legs (its right side is the game's "L")
      RightLeg: "shinL",
      LeftLeg: "shinR",
      RightFoot: "footL",
      LeftFoot: "footR",
      Hips: "hips",
      Spine: "spine",
      HandL: "handL",
      HandR: "handR",
    };
    for (const child of node.getDescendants(false)) {
      if (!(child instanceof TransformNode)) continue;
      const suffix = Object.keys(parts).find((s) => child.name.endsWith(`_${s}`));
      if (!suffix) continue;
      child.rotationQuaternion ??= Quaternion.FromEulerVector(child.rotation);
      this.joints[parts[suffix]] = { node: child, rest: child.rotationQuaternion.clone(), frame: Quaternion.Identity(), frameInv: Quaternion.Identity() };
    }
    // Each joint's orientation relative to the character, so a pose like "swing the arm forward"
    // means the same on every skeleton, whichever way its bones happen to be rolled. Worked out
    // from the bones' own (glTF) rotations: the loader's root above them mirrors the model.
    for (const joint of Object.values(this.joints)) {
      let frame = Quaternion.Identity();
      for (let n: TransformNode | null = joint!.node; n && n.name !== "__root__" && !n.name.endsWith("/__root__"); n = n.parent as TransformNode | null) {
        frame = (n.rotationQuaternion ?? Quaternion.FromEulerVector(n.rotation)).multiply(frame);
      }
      joint!.frame = frame;
      joint!.frameInv = Quaternion.Inverse(frame);
    }

    // short-legged characters (the chibi cast) already sit at chair height
    const hip = this.joints.legL?.node;
    if (hip) {
      node.computeWorldMatrix(true);
      hip.computeWorldMatrix(true);
      this.hipHeight = hip.getAbsolutePosition().y;
      this.sitDrop = Math.max(0, Math.min(SIT_DROP, this.hipHeight - 0.48));
    }

    const handNodes = node.getDescendants(false).filter((n): n is TransformNode => n instanceof TransformNode);
    const handL = handNodes.find((n) => n.name.endsWith("_HandL"));
    const handR = handNodes.find((n) => n.name.endsWith("_HandR"));
    if (handL && handR) this.hands = { l: handL, r: handR };

    // a knife that appears in the right hand while chopping
    const hand = this.hands?.r ?? this.joints.foreR?.node;
    if (hand && lib.has("Knife")) {
      const knife = lib.spawn("Knife");
      knife.parent = hand;
      if (this.hands) knife.position.set(0, 0.04, 0.02);
      else knife.position.set(0, -FOREARM + 0.01, 0.02);
      knife.rotation.set(Math.PI / 2, -Math.PI / 2, 0); // blade forward out of the fist
      knife.scaling.setAll(1.15);
      knife.setEnabled(false);
      this.knife = knife;
    }
    if (hand) {
      const steel = new StandardMaterial("cutlery", scene);
      steel.diffuseColor = new Color3(0.82, 0.84, 0.87);
      steel.specularColor = new Color3(0.9, 0.9, 0.9);
      const piece = (name: string) => {
        const root = new TransformNode(name, scene);
        root.parent = hand;
        if (this.hands) root.position.set(0, 0.035, 0.015);
        else root.position.set(0, -FOREARM + 0.01, 0.02);
        root.rotation.set(Math.PI / 2, -Math.PI / 2, 0); // pointing out of the fist, like the knife
        root.setEnabled(false);
        return root;
      };
      const part = (mesh: Mesh, root: TransformNode) => {
        mesh.material = steel;
        mesh.parent = root;
        return mesh;
      };
      // a fork: a slim handle, then four tines
      const fork = piece("fork");
      part(MeshBuilder.CreateBox("forkHandle", { width: 0.014, height: 0.11, depth: 0.006 }, scene), fork).position.y = 0.055;
      part(MeshBuilder.CreateBox("forkNeck", { width: 0.022, height: 0.02, depth: 0.005 }, scene), fork).position.y = 0.12;
      for (let i = 0; i < 4; i++) part(MeshBuilder.CreateBox(`forkTine${i}`, { width: 0.004, height: 0.04, depth: 0.004 }, scene), fork).position.set(-0.009 + i * 0.006, 0.15, 0);
      // a spoon: a slim handle and a shallow oval bowl
      const spoon = piece("spoon");
      part(MeshBuilder.CreateBox("spoonHandle", { width: 0.013, height: 0.11, depth: 0.006 }, scene), spoon).position.y = 0.055;
      const bowl = part(MeshBuilder.CreateSphere("spoonBowl", { diameter: 0.04, segments: 8 }, scene), spoon);
      bowl.position.y = 0.13;
      bowl.scaling.set(0.85, 1.25, 0.35);
      this.cutlery = { fork, spoon };
    }
  }

  /** Where the right hand is (a spice bottle goes here), or null without a character model. */
  rightHandPoint(): Vector3 | null {
    if (this.hands) return this.hands.r.getAbsolutePosition().clone();
    const r = this.joints.foreR?.node;
    return r ? Vector3.TransformCoordinates(new Vector3(0, -FOREARM, 0.02), r.getWorldMatrix()) : null;
  }

  /**
   * Put a hat on. The chefs' models wear a toque already: the toque look tints it, and any other
   * hat (built from simple shapes, riding on the head bone) takes its place where its band sat.
   */
  setLook(look: ChefLook | undefined) {
    this.hat?.dispose(false, true);
    this.hat = null;
    const head = this.joints.head?.node;
    if (!look || !head) return;
    const scene = head.getScene();
    this.root.computeWorldMatrix(true);
    const toque = this.bob.getChildMeshes(false).filter((m) => /Toque_/.test(m.name));
    for (const mesh of toque) {
      mesh.setEnabled(look.hat === "toque");
      if (look.hat !== "toque" || !mesh.material) continue;
      const tinted = mesh.material.clone(`${mesh.material.name}-${look.color}`)!;
      const color = Color3.FromHexString(look.color);
      if ("albedoColor" in tinted) tinted.albedoColor = color;
      else if ("diffuseColor" in tinted) tinted.diffuseColor = color;
      mesh.material = tinted;
    }
    if (look.hat === "none" || look.hat === "toque") return;
    // where the toque's band sat is the top of the head; its width is the head's
    const band = toque.find((m) => m.name.endsWith("Toque_Band"))?.getBoundingInfo().boundingBox;
    const at = head.getAbsolutePosition();
    const { max } = this.bob.getHierarchyBoundingVectors(true);
    const size = band ? Math.max(band.maximumWorld.x - band.minimumWorld.x, band.maximumWorld.z - band.minimumWorld.z) * 1.15 : 0.3;
    const hat = buildHat(scene, look, size);
    hat.position.set(at.x, band ? band.minimumWorld.y - size * 0.05 : max.y, at.z);
    hat.rotation.y = this.root.rotation.y;
    hat.setParent(head);
    this.hat = hat;
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
    if (this.hands) {
      // between the palms
      return this.hands.l.getAbsolutePosition().add(this.hands.r.getAbsolutePosition()).scaleInPlace(0.5);
    }
    const l = this.joints.foreL?.node;
    const r = this.joints.foreR?.node;
    if (!l || !r) {
      // no forearms (the chibi cast): just below and in front of the shoulders
      const al = this.joints.armL?.node;
      const ar = this.joints.armR?.node;
      if (!al || !ar) return null;
      const mid = al.getAbsolutePosition().add(ar.getAbsolutePosition()).scaleInPlace(0.5);
      const yaw = this.root.rotation.y;
      return new Vector3(mid.x + Math.sin(yaw) * 0.32, mid.y - 0.12, mid.z + Math.cos(yaw) * 0.32);
    }
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
    const jog = Scalar.Clamp((this.speed - 1.2) / 1.2, 0, 1);
    this.phase += (moved / Scalar.Lerp(WALK_STRIDE, JOG_STRIDE, jog)) * Math.PI * 2 + shuffle * dt * 9;
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

    // --- arm base while busy with one hand: an easy swing with the walk ---
    armL.x = -FWD * sin * 0.45 * walk;
    armR.x = FWD * sin * 0.45 * walk;
    armL.z = 0.06;
    armR.z = -0.06;
    foreL.x = FWD * (0.15 + 0.25 * walk + Math.max(0, -sin) * 0.3 * walk);
    foreR.x = FWD * (0.15 + 0.25 * walk + Math.max(0, sin) * 0.3 * walk);
    this.sit = Scalar.Lerp(this.sit, s.sitting ? 1 : 0, Math.min(1, dt * 6));
    if (s.eating) {
      // a bite: scoop from the plate, lift to the mouth (leaning in to meet it), chew, and back down.
      // A spoon goes slower and stays level so the soup doesn't spill.
      const spoon = s.utensil === "spoon";
      const cycle = ((time * (spoon ? 0.36 : 0.42)) % 1 + 1) % 1;
      const ease = (a: number, b: number) => Scalar.SmoothStep(0, 1, Scalar.Clamp((cycle - a) / (b - a), 0, 1));
      const down = ease(0, 0.18) * (1 - ease(0.28, 0.32)); // reaching into the plate
      const scoop = Math.sin(Scalar.Clamp((cycle - 0.16) / 0.14, 0, 1) * Math.PI); // a little scoop or twirl
      const up = ease(0.3, 0.5) * (1 - ease(0.78, 0.98)); // to the mouth and back
      const chew = cycle > 0.5 && cycle < 0.85 ? Math.sin(time * 14) * 0.5 + 0.5 : 0;
      armR.x = FWD * (0.5 - 0.12 * down + 0.5 * up);
      foreR.x = FWD * (1.0 - 0.15 * down + (spoon ? 1.0 : 1.15) * up);
      foreR.z = (spoon ? 0.05 : 0.15) * scoop;
      armR.z = -0.08;
      // the other hand rests at the plate, steadying it (or holding the bowl)
      armL.x = FWD * (spoon ? 0.62 : 0.5);
      foreL.x = FWD * (spoon ? 1.15 : 1.0);
      armL.z = 0.14;
      torso.x += TILT * (0.08 + 0.06 * down + 0.04 * up);
      head.x += TILT * (0.22 + 0.08 * down - 0.12 * up) + TILT * chew * 0.03;
    }
    if (this.cutlery) {
      this.cutlery.fork.setEnabled(!!s.eating && s.utensil !== "spoon");
      this.cutlery.spoon.setEnabled(!!s.eating && s.utensil === "spoon");
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

    // --- a spice bottle: held up in the right hand, the left free ---
    if (s.bottle && !s.holding) {
      armR.x = FWD * (0.6 + sin * 0.04 * walk);
      foreR.x = FWD * 1.2;
      armR.z = -0.12;
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
        case "wave":
          armR.x = FWD * 2.5 * env; // a big wave over the head
          armR.z = -0.35 * env;
          foreR.x = FWD * 0.25 * env;
          foreR.z = wave(4) * 0.45 * env;
          torso.z = wave(2) * 0.05 * env;
          break;
        case "pickup":
        case "place": {
          // reach out and down, a beat to grasp (or let go), then draw back: the right hand leads
          // and the left follows a moment behind, and the head watches the hands
          const reach = (lag: number) => {
            const q = Scalar.Clamp((p - lag) / (1 - lag), 0, 1);
            return q < 0.45 ? Scalar.SmoothStep(0, 1, q / 0.45) : q < 0.6 ? 1 : 1 - Scalar.SmoothStep(0, 1, (q - 0.6) / 0.4);
          };
          const r = reach(0);
          const l = reach(0.12);
          torso.x += TILT * 0.32 * r;
          head.x += TILT * (0.2 + 0.2 * r);
          armR.x = FWD * (0.55 + 0.55 * r);
          foreR.x = FWD * (1.05 - 0.55 * r);
          armL.x = FWD * (0.55 + 0.45 * l);
          foreL.x = FWD * (1.05 - 0.45 * l);
          // fingers closing (or opening) at the bottom of the reach: a little wrist turn
          foreR.z = -0.12 * Math.sin(Math.PI * Scalar.Clamp((p - 0.35) / 0.3, 0, 1));
          break;
        }
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

    // --- the clips underneath: idle / walk / jog by speed, sitting over them all ---
    const gaitT = (clip: Clip) => ((this.phase / (Math.PI * 2)) % 1 + 1) % 1 * clip.frames;
    const idleT = time * CLIPS.Idle_Loop.fps;
    const sitT = time * CLIPS.Sitting_Idle_Loop.fps;
    const clipFor = (joint: JointName) => {
      const gait = Quaternion.Slerp(clipTurn(CLIPS.Walk_Loop, joint, gaitT(CLIPS.Walk_Loop)), clipTurn(CLIPS.Jog_Fwd_Loop, joint, gaitT(CLIPS.Jog_Fwd_Loop)), jog);
      const standing = Quaternion.Slerp(clipTurn(CLIPS.Idle_Loop, joint, idleT), gait, walk);
      return Quaternion.Slerp(standing, clipTurn(CLIPS.Sitting_Idle_Loop, joint, sitT), this.sit);
    };
    const gaitHip = Scalar.Lerp(lerpLoop(CLIPS.Walk_Loop.hip, gaitT(CLIPS.Walk_Loop)), lerpLoop(CLIPS.Jog_Fwd_Loop.hip, gaitT(CLIPS.Jog_Fwd_Loop)), jog);
    const hip = Scalar.Lerp(lerpLoop(CLIPS.Idle_Loop.hip, idleT), gaitHip, walk);
    // a smaller body (a kid, drawn at 70%) lowers less, or even rises, in its own units, so its
    // hips still land on the chair seat (legs dangling) instead of sinking through it
    const scale = this.root.scaling.y || 1;
    const sitDrop = Math.min(this.sitDrop, this.hipHeight - 0.48 / scale);
    this.bob.position.y = hip * this.hipHeight * (1 - this.sit) - sitDrop * this.sit;

    const nod = g?.kind === "yes" || g?.kind === "no";
    const busy = s.holding || s.chopping || s.stirring || s.eating || s.guided || s.guiding || (!!g && !nod);
    this.armsBusy = Scalar.Lerp(this.armsBusy, busy ? 1 : 0, Math.min(1, dt * 12));

    // clips are already smooth, so legs and body follow them exactly; game poses ease in
    const rate = Math.min(1, dt * 16);
    const free = 1 - this.armsBusy;
    for (const j of ["hips", "spine", "legL", "legR", "shinL", "shinR", "footL", "footR"] as const) this.apply(j, zero(), 1, clipFor(j), 1);
    this.apply("torso", torso, rate, clipFor("torso"), 1, true);
    this.apply("head", head, rate, clipFor("head"), 1, true);
    this.apply("armL", armL, rate, clipFor("armL"), free);
    this.apply("armR", armR, rate, clipFor("armR"), free);
    this.apply("foreL", foreL, rate, clipFor("foreL"), free);
    this.apply("foreR", foreR, rate, clipFor("foreR"), free);
    this.apply("handL", zero(), rate, clipFor("handL"), free);
    this.apply("handR", zero(), rate, clipFor("handR"), free);
  }

  /**
   * Pose a joint: the game's pose, mixed with the clip's turn by clipWeight (or on top of it, when
   * additive). Turns are in the character's frame and carried into the bone's own frame.
   */
  private apply(name: JointName, pose: Pose, rate: number, clip: Quaternion, clipWeight: number, additive = false) {
    const joint = this.joints[name];
    if (!joint) return;
    // game poses read in Babylon's axes; carried into the bones' mirrored (glTF) ones
    const y = Quaternion.RotationAxis(Axis.Y, pose.y).multiply(Quaternion.RotationAxis(Axis.X, pose.x)).multiply(Quaternion.RotationAxis(Axis.Z, pose.z));
    const game = new Quaternion(y.x, -y.y, -y.z, y.w);
    const turn = additive ? clip.multiply(game) : Quaternion.Slerp(game, clip, clipWeight);
    const target = joint.rest.multiply(joint.frameInv.multiply(turn).multiply(joint.frame));
    joint.node.rotationQuaternion = Quaternion.Slerp(joint.node.rotationQuaternion!, target, rate);
  }
}

/** A hat from a few primitives, its brim at y = 0, facing +z. */
function buildHat(scene: Scene, look: ChefLook, size: number): TransformNode {
  const root = new TransformNode(`hat-${look.hat}`, scene);
  const mat = new StandardMaterial(`hatMat-${look.hat}-${look.color}`, scene);
  // a little deeper than the swatch: the kitchen's bright light washes pastels out
  mat.diffuseColor = (look.hat === "crown" ? Color3.FromHexString("#f2c14e") : Color3.FromHexString(look.color)).scale(0.8);
  mat.specularColor = look.hat === "crown" ? new Color3(0.6, 0.5, 0.2) : new Color3(0.08, 0.08, 0.08);
  const add = (mesh: Mesh, x: number, y: number, z: number) => {
    mesh.material = mat;
    mesh.parent = root;
    mesh.position.set(x, y, z);
    mesh.isPickable = false;
    return mesh;
  };
  const s = size;
  switch (look.hat) {
    case "toque": // the tall pleated chef's hat
      add(MeshBuilder.CreateCylinder("band", { diameter: s * 0.95, height: s * 0.45, tessellation: 20 }, scene), 0, s * 0.22, 0);
      add(MeshBuilder.CreateSphere("puff", { diameter: s * 1.25, segments: 12 }, scene), 0, s * 0.62, 0).scaling.y = 0.7;
      break;
    case "beanie": {
      const dome = add(MeshBuilder.CreateSphere("dome", { diameter: s * 1.05, segments: 14, slice: 0.5 }, scene), 0, 0, 0);
      dome.scaling.y = 0.9;
      add(MeshBuilder.CreateTorus("rim", { diameter: s * 1.0, thickness: s * 0.14, tessellation: 22 }, scene), 0, s * 0.03, 0);
      add(MeshBuilder.CreateSphere("bobble", { diameter: s * 0.3, segments: 8 }, scene), 0, s * 0.5, 0);
      break;
    }
    case "cap": {
      add(MeshBuilder.CreateSphere("crown", { diameter: s * 1.02, segments: 14, slice: 0.5 }, scene), 0, 0, 0).scaling.y = 0.75;
      const brim = add(MeshBuilder.CreateCylinder("brim", { diameter: s * 0.75, height: s * 0.04, tessellation: 18 }, scene), 0, s * 0.02, s * 0.42);
      brim.scaling.z = 0.75;
      break;
    }
    case "crown": {
      add(MeshBuilder.CreateCylinder("ring", { diameter: s * 0.9, height: s * 0.32, tessellation: 8 }, scene), 0, s * 0.16, 0);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        add(MeshBuilder.CreateSphere("jewel", { diameter: s * 0.17, segments: 6 }, scene), Math.sin(a) * s * 0.45, s * 0.38, Math.cos(a) * s * 0.45);
      }
      break;
    }
  }
  return root;
}
