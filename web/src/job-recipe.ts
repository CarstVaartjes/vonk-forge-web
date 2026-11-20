import type { JobContract, JobOption, JobSlot } from "./api/client";

// The command the Controller runbook documents (`vonkctl job run ALIAS --input SLOT=PATH --option KEY=VALUE --output DIR`),
// built from this recipe's own required input slots (the Controller fills option defaults), never a fixed slot name.
export function jobRunCommand(job: JobContract): string {
  const inputs = job.inputs.filter((slot) => slot.min_files > 0).flatMap((slot) => {
    const extension = slot.extensions[0] ?? "";
    return Array.from({ length: slot.min_files }, (_, index) => `--input ${slot.id}=${slot.id}${slot.min_files > 1 ? `-${index + 1}` : ""}${extension}`);
  });
  return ["vonkctl job run ALIAS", ...inputs, "--output results"].join(" \\\n  ");
}

export function slotCount(slot: JobSlot): string {
  if (slot.min_files === slot.max_files) return slot.max_files === 1 ? "1 file" : `${slot.max_files} files`;
  return slot.min_files === 0 ? `up to ${slot.max_files} ${slot.max_files === 1 ? "file" : "files"}` : `${slot.min_files} to ${slot.max_files} files`;
}

export function optionType(option: JobOption): string {
  if (typeof option.default === "boolean") return "on or off";
  if (typeof option.default === "number") return "number";
  return "text";
}

export function optionRange(option: JobOption): string {
  if (option.allowed_values?.length) return `one of ${option.allowed_values.join(", ")}`;
  if (option.minimum === undefined && option.maximum === undefined) return "";
  // A bound beyond the safe integer range (a seed's int64 limit) has lost digits in JSON parsing: it is "any", not a wrong number.
  const bound = (value: number | undefined) => (value === undefined || Math.abs(value) > Number.MAX_SAFE_INTEGER ? "any" : String(value));
  const range = `${bound(option.minimum)} to ${bound(option.maximum)}`;
  return option.step === undefined ? range : `${range}, step ${option.step}`;
}
