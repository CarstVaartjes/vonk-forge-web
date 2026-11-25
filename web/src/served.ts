// What a recipe's launch serves, read from the recipe's own published API facts (a chat or
// decision API's input modalities, tools, reasoning and structured output) or, for a job
// recipe, from the media its job slots take and make. The recipe library publishes no per-recipe
// capability list, so these are the site's own words for those facts, not contract capability
// names. A Model page keeps showing the model's declared capabilities; a recipe row, card and
// filter show only this.
const SERVED_LABELS = {
  in_text: "Text in",
  in_image: "Image in",
  in_video: "Video in",
  in_audio: "Audio in",
  in_pdf: "PDF in",
  in_model: "3D in",
  out_image: "Image out",
  out_video: "Video out",
  out_audio: "Audio out",
  out_model: "3D out",
  tools: "Tool calls",
  thinking: "Reasoning",
  json: "Structured output",
} as const;

export type ServedFact = keyof typeof SERVED_LABELS;

export const SERVED_FACTS = Object.keys(SERVED_LABELS) as ServedFact[];

export function servedLabel(fact: string): string {
  return isServedFact(fact) ? SERVED_LABELS[fact] : fact;
}

export function isServedFact(value: string): value is ServedFact {
  return Object.hasOwn(SERVED_LABELS, value);
}

type Media = "text" | "image" | "video" | "audio" | "pdf" | "model";

function mediaOf(mediaType: string): Media | undefined {
  if (mediaType === "application/pdf") return "pdf";
  const major = mediaType.split("/")[0];
  return major === "text" ||
    major === "image" ||
    major === "video" ||
    major === "audio" ||
    major === "model"
    ? major
    : undefined;
}

interface ServedInput {
  // The recipe's API facts; absent for a recipe with none.
  api?:
    | {
        input_modalities?: Record<Exclude<Media, "model">, boolean>;
        audio_output?: boolean;
        tools?: { kind: string };
        reasoning?: { kind: string };
        structured_output?: boolean;
        mode: string;
      }
    | undefined;
  job?: { inputs: { media_types: string[] }[]; outputs: { media_types: string[] }[] } | undefined;
}

export function servedFacts({ api, job }: ServedInput): ServedFact[] {
  const served = new Set<ServedFact>();
  if (api?.input_modalities) {
    for (const media of ["text", "image", "video", "audio", "pdf"] as const)
      if (api.input_modalities[media]) served.add(`in_${media}`);
  }
  if (api && api.mode === "audio_speech") {
    served.add("in_text");
    served.add("out_audio");
  }
  if (api && api.mode === "audio_transcription") served.add("in_audio");
  if (api?.audio_output) served.add("out_audio");
  if (api?.tools && api.tools.kind !== "none") served.add("tools");
  if (api?.reasoning && api.reasoning.kind !== "none") served.add("thinking");
  if (api?.structured_output) served.add("json");
  for (const slot of job?.inputs ?? []) {
    for (const type of slot.media_types) {
      const media = mediaOf(type);
      if (media) served.add(`in_${media}`);
    }
  }
  for (const slot of job?.outputs ?? []) {
    for (const type of slot.media_types) {
      const media = mediaOf(type);
      if (media && media !== "text" && media !== "pdf") served.add(`out_${media}`);
    }
  }
  return SERVED_FACTS.filter((fact) => served.has(fact));
}
