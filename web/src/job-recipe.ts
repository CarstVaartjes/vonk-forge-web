import type { JobContract, JobOption, JobSlot } from "./api/client";

// The command the Controller runbook documents (`vonkctl job run ALIAS --input SLOT=PATH --option KEY=VALUE --output DIR`),
// built from this recipe's own required input slots and options, never a fixed slot name.
export function jobRunCommand(job: JobContract): string {
  const inputs = job.inputs.filter((slot) => slot.min_files > 0).flatMap((slot) => {
    const extension = slot.extensions[0] ?? "";
    return Array.from({ length: slot.min_files }, (_, index) => `--input ${slot.id}=${slot.id}${slot.min_files > 1 ? `-${index + 1}` : ""}${extension}`);
  });
  const options = job.options.map((option) => `--option ${option.key}=${option.default}`);
  return ["vonkctl job run ALIAS", ...inputs, ...options, "--output results"].join(" \\\n  ");
}

export function slotCount(slot: JobSlot): string {
  if (slot.min_files === slot.max_files) return slot.max_files === 1 ? "1 file" : `${slot.max_files} files`;
  return slot.min_files === 0 ? `optional, up to ${slot.max_files}` : `${slot.min_files} to ${slot.max_files} files`;
}

export function optionType(option: JobOption): string {
  if (typeof option.default === "boolean") return "on or off";
  if (typeof option.default === "number") return Number.isInteger(option.default) ? "whole number" : "number";
  return "text";
}

export function optionRange(option: JobOption): string {
  if (option.allowed_values?.length) return `one of ${option.allowed_values.join(", ")}`;
  if (option.minimum === undefined && option.maximum === undefined) return "";
  const range = `${option.minimum ?? "any"} to ${option.maximum ?? "any"}`;
  return option.step === undefined ? range : `${range}, step ${option.step}`;
}
