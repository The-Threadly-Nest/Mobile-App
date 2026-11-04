import type { ZodIssue } from "zod";

function fieldLabel(path: PropertyKey[]): string {
  const field = [...path].reverse().find((part) => typeof part === "string");
  const labels: Record<string, string> = {
    id: "selection", fashionHouseId: "fashion house", customerId: "customer", staffId: "staff member",
    availableSlotId: "fitting time", catalogItemId: "item", idToken: "Google sign-in", pushToken: "notification settings",
    code: "verification code", token: "code", newPassword: "new password", currentPassword: "current password",
  };
  if (!field || typeof field !== "string") return "details";
  return labels[field] ?? field.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").toLowerCase();
}

export function validationMessage(issue: ZodIssue): string {
  const label = fieldLabel(issue.path);
  if (issue.code === "custom") return issue.message;
  if (issue.code === "invalid_format") {
    if (issue.format === "email") return "Enter a valid email address.";
    if (issue.format === "url") return `Enter a valid link for ${label}.`;
    if (issue.format === "uuid") return `Please select a valid ${label} and try again.`;
    if (issue.format === "regex" && !issue.message.startsWith("Invalid")) return `${label.charAt(0).toUpperCase()}${label.slice(1)}: ${issue.message}`;
  }
  if (issue.code === "invalid_type") return `Please enter a valid ${label}.`;
  if (issue.code === "too_small") {
    if (issue.origin === "string") return issue.minimum === 1 ? `Please enter your ${label}.` : `Your ${label} needs at least ${issue.minimum} characters.`;
    if (issue.origin === "array") return `Please choose at least ${issue.minimum} ${label}.`;
    if (issue.origin === "number") return `Enter a ${label} ${issue.inclusive ? "of at least" : "greater than"} ${issue.minimum}.`;
  }
  if (issue.code === "too_big") {
    if (issue.origin === "string") return `Keep your ${label} to ${issue.maximum} characters or fewer.`;
    if (issue.origin === "array") return `Please choose no more than ${issue.maximum} ${label}.`;
    if (issue.origin === "number") return `Enter a ${label} ${issue.inclusive ? "of at most" : "less than"} ${issue.maximum}.`;
  }
  if (issue.code === "invalid_value") return `Please choose a valid ${label}.`;
  return `Please check your ${label} and try again.`;
}
