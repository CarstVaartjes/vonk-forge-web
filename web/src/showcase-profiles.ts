// Example fleet profiles for the 3D game generation showcase. This is the only
// hand-written data on the page: which recipes sit in which profile and what
// role they play. Titles, memory, status and links come from the published
// catalog. Column placement is presentational; the light coder is always left.
export const SHOWCASE_PUBLISHER = "vonk-forge";

export type ShowcaseRole = "coder" | "image" | "3d" | "audio" | "video";
export type ShowcaseColumn = "left" | "right" | "both";

export interface ShowcaseMember {
  slug: string;
  role: ShowcaseRole;
  column: ShowcaseColumn;
}

export interface ShowcaseProfile {
  id: string;
  title: string;
  members: ShowcaseMember[];
}

export const ROLE_LABELS: Record<ShowcaseRole, string> = {
  coder: "Coder",
  image: "Concept art",
  "3d": "3D",
  audio: "Audio",
  video: "Video",
};

export const LIGHT_CODER = "qwen3-8-27b-exl3-dflash2-mia-single";

const lightCoder: ShowcaseMember = { slug: LIGHT_CODER, role: "coder", column: "left" };

export const SHOWCASE_PROFILES: ShowcaseProfile[] = [
  { id: "code-glm", title: "Code: GLM 5.3 Flash", members: [
    { slug: "glm-5-3-flash-exl3-dflash2-tensorfold-mia-dual", role: "coder", column: "both" },
  ] },
  { id: "code-deepseek", title: "Code: DeepSeek V4.1 Flash", members: [
    { slug: "deepseek-v4-1-flash-1017-mia-tensorfold-dual", role: "coder", column: "both" },
  ] },
  { id: "concept-art", title: "Concept art", members: [
    lightCoder,
    { slug: "flux-2-klein-4b-nvfp4-comfyui-single", role: "image", column: "left" },
    { slug: "qwen-image-edit-2511-fp8mixed-comfyui-single", role: "image", column: "right" },
  ] },
  { id: "3d-assets", title: "3D assets", members: [
    lightCoder,
    { slug: "trellis-2-4b-pytorch-single", role: "3d", column: "left" },
    { slug: "step1x-3d-texture-pytorch-single", role: "3d", column: "right" },
  ] },
  { id: "controllable-3d", title: "Controllable 3D", members: [
    lightCoder,
    { slug: "hunyuan3d-omni-pytorch-single", role: "3d", column: "left" },
    { slug: "step1x-3d-texture-pytorch-single", role: "3d", column: "right" },
  ] },
  { id: "audio", title: "Audio", members: [
    lightCoder,
    { slug: "minimax-music3-drowzeys-tensorfold-single", role: "audio", column: "left" },
    { slug: "hunyuan-video-foley-xxl-pytorch-single", role: "audio", column: "left" },
    { slug: "fasth3-8step-v2-drowzeys-tensorfold-single", role: "audio", column: "right" },
  ] },
  { id: "trailer", title: "Trailer & cutscenes", members: [
    lightCoder,
    { slug: "wan-2-2-i2v-14b-comfyui-single", role: "video", column: "right" },
  ] },
];
