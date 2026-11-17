// Art direction: soft, warm, toy-like lighting in the spirit of the reference images.
// Pastel gradient sky, warm sun with soft shadows, ambient occlusion and a little bloom so the
// heat lamps, windows and string lights glow.
import {
  Color3,
  Color4,
  DefaultRenderingPipeline,
  DirectionalLight,
  DynamicTexture,
  HemisphericLight,
  ImageProcessingConfiguration,
  Layer,
  PointLight,
  SSAO2RenderingPipeline,
  ShadowGenerator,
  Vector3,
  type Camera,
  type Scene,
} from "@babylonjs/core";

export interface Look {
  /** shadows of what moves (chefs, customers, food and dishes): redrawn every frame */
  shadows: ShadowGenerator;
  /** shadows of the room and the stations: drawn once per kitchen (see redrawRoomShadows) */
  roomShadows: ShadowGenerator;
  /** The kitchen was rebuilt (or its models just arrived): draw the room's shadows again, once. */
  redrawRoomShadows(): void;
  /**
   * @param dark 0 = normal, 1 = power cut (only the window glow and emissive lamps remain)
   * @param flash extra exposure for a lightning flash
   */
  setAtmosphere(dark: number, flash: number): void;
  /** Fast graphics (phones): no ambient occlusion, no multisampling, no bloom; FXAA keeps edges smooth. */
  setFast(fast: boolean): void;
}

export function setupLook(scene: Scene, cameras: Camera[]): Look {
  scene.clearColor = new Color4(0.78, 0.82, 0.9, 1);

  const sky = new DynamicTexture("skyGradient", { width: 4, height: 256 }, scene, false);
  const ctx = sky.getContext();
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "#8eb2d8");
  gradient.addColorStop(0.55, "#c8d2e6");
  gradient.addColorStop(1, "#f0d4c4");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 256);
  sky.update();
  new Layer("sky", null, scene, true).texture = sky;

  const hemi = new HemisphericLight("hemi", new Vector3(0.2, 1, -0.3), scene);
  hemi.intensity = 0.8;
  hemi.diffuse = Color3.FromHexString("#fff4e6");
  hemi.groundColor = Color3.FromHexString("#6f7d94");
  hemi.specular = Color3.Black();

  // The sun is two lights in the same place, each carrying a share of its brightness: one casts
  // the room's shadows (hundreds of meshes that never move, drawn into its shadow map once per
  // kitchen), the other the shadows of the few things that move (redrawn every frame). One light
  // with one shadow map drew the whole kitchen a second time, every frame.
  const SUN = 2.0;
  const ROOM_SHARE = 0.55;
  const sunLight = (name: string) => {
    const light = new DirectionalLight(name, new Vector3(-0.45, -1, 0.6), scene);
    light.position = new Vector3(6, 12, -8);
    light.diffuse = Color3.FromHexString("#fff0dc");
    return light;
  };
  const sun = sunLight("sun");
  const moverSun = sunLight("sunMovers");
  // the movers' map covers the same patch of floor every frame, so its shadows don't crawl as chefs walk
  moverSun.shadowFrustumSize = 20;
  moverSun.shadowMinZ = 1;
  moverSun.shadowMaxZ = 40;

  const shadowsFor = (light: DirectionalLight, size: number, quality: number) => {
    const generator = new ShadowGenerator(size, light);
    generator.usePercentageCloserFiltering = true;
    generator.filteringQuality = quality;
    generator.bias = 0.0008;
    generator.normalBias = 0.01;
    // each light is only part of the sun, so its shadow takes all of its own light away
    generator.darkness = 0;
    return generator;
  };
  const roomShadows = shadowsFor(sun, 2048, ShadowGenerator.QUALITY_HIGH);
  const roomMap = roomShadows.getShadowMap()!;
  roomMap.refreshRate = 0; // RenderTargetTexture.REFRESHRATE_RENDER_ONCE
  const redrawRoomShadows = () => roomMap.resetRefreshCounter();
  const shadows = shadowsFor(moverSun, 1024, ShadowGenerator.QUALITY_MEDIUM);

  // warm pool of light under the pass heat lamps
  const passGlow = new PointLight("passGlow", new Vector3(0, 1.55, -2.45), scene);
  passGlow.diffuse = Color3.FromHexString("#ffb35c");
  passGlow.specular = Color3.Black();
  passGlow.intensity = 1.3;
  passGlow.range = 2.6;

  const pipeline = new DefaultRenderingPipeline("look", true, scene, cameras);
  pipeline.samples = 4;
  pipeline.fxaaEnabled = true;
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.85;
  pipeline.bloomWeight = 0.35;
  pipeline.bloomKernel = 48;
  pipeline.bloomScale = 0.5;
  pipeline.imageProcessingEnabled = true;
  const ip = pipeline.imageProcessing;
  ip.toneMappingEnabled = true;
  ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.exposure = 1.1;
  ip.contrast = 1.08;
  ip.vignetteEnabled = true;
  ip.vignetteWeight = 1.1;
  ip.vignetteColor = new Color4(0.18, 0.12, 0.2, 0);

  const ssao = new SSAO2RenderingPipeline("ssao", scene, { ssaoRatio: 0.5, blurRatio: 0.5 }, cameras);
  ssao.radius = 0.5;
  ssao.totalStrength = 0.9;
  // the kitchen is seen from the chef's eyes, close to the walls: fewer samples or the cheap blur
  // leave dark smudges on flat surfaces
  ssao.samples = 16;
  ssao.maxZ = 40;
  ssao.expensiveBlur = true;

  const base = { hemi: hemi.intensity, glow: passGlow.intensity, exposure: ip.exposure };
  let fastNow = false;
  let darkNow = 0;
  /** The sun's brightness, shared between its two lights (Fast has no shadows, so one light carries it all). */
  function setSun() {
    const lit = SUN * (1 - 0.97 * darkNow);
    moverSun.setEnabled(!fastNow);
    sun.intensity = fastNow ? lit : lit * ROOM_SHARE;
    moverSun.intensity = lit * (1 - ROOM_SHARE);
  }
  setSun();
  function setAtmosphere(dark: number, flash: number) {
    hemi.intensity = base.hemi * (1 - 0.94 * dark);
    darkNow = dark;
    setSun();
    passGlow.intensity = base.glow * (1 - dark);
    ip.exposure = base.exposure * (1 - 0.8 * dark) + flash;
  }

  // ambient occlusion starts on; only a real change attaches or detaches it (attaching twice breaks it)
  function setFast(fast: boolean) {
    if (fast === fastNow) return;
    fastNow = fast;
    setSun();
    if (!fast) redrawRoomShadows();
    pipeline.samples = fast ? 1 : 4;
    pipeline.bloomEnabled = !fast;
    const manager = scene.postProcessRenderPipelineManager;
    if (fast) manager.detachCamerasFromRenderPipeline("ssao", cameras);
    else manager.attachCamerasToRenderPipeline("ssao", cameras);
  }

  return { shadows, roomShadows, redrawRoomShadows, setAtmosphere, setFast };
}
