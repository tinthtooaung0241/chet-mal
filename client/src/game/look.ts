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
  shadows: ShadowGenerator;
  /**
   * @param dark 0 = normal, 1 = power cut (only the window glow and emissive lamps remain)
   * @param flash extra exposure for a lightning flash
   */
  setAtmosphere(dark: number, flash: number): void;
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

  const sun = new DirectionalLight("sun", new Vector3(-0.45, -1, 0.6), scene);
  sun.position = new Vector3(6, 12, -8);
  sun.intensity = 2.0;
  sun.diffuse = Color3.FromHexString("#fff0dc");

  const shadows = new ShadowGenerator(2048, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.filteringQuality = ShadowGenerator.QUALITY_HIGH;
  shadows.bias = 0.0008;
  shadows.normalBias = 0.01;
  shadows.darkness = 0.3;

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
  ssao.totalStrength = 1.1;
  ssao.samples = 16;
  ssao.maxZ = 40;
  ssao.expensiveBlur = true;

  const base = { hemi: hemi.intensity, sun: sun.intensity, glow: passGlow.intensity, exposure: ip.exposure };
  function setAtmosphere(dark: number, flash: number) {
    hemi.intensity = base.hemi * (1 - 0.94 * dark);
    sun.intensity = base.sun * (1 - 0.97 * dark);
    passGlow.intensity = base.glow * (1 - dark);
    ip.exposure = base.exposure * (1 - 0.8 * dark) + flash;
  }

  return { shadows, setAtmosphere };
}
