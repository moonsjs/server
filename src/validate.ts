import type { StandardSchemaV1 } from "@standard-schema/spec";

export type SchemaValidationResult<Output> =
  | { ok: true; value: Output }
  | { ok: false; issues: string[] };

/** Validasi memakai Standard Schema (PRD §7.1); sync maupun async didukung. */
export async function validateSchema<S extends StandardSchemaV1>(
  schema: S,
  value: unknown,
): Promise<SchemaValidationResult<StandardSchemaV1.InferOutput<S>>> {
  const result = await schema["~standard"].validate(value);

  if (result.issues !== undefined) {
    return { ok: false, issues: result.issues.map((issue) => formatIssue(issue)) };
  }

  return { ok: true, value: result.value as StandardSchemaV1.InferOutput<S> };
}

function formatIssue(issue: StandardSchemaV1.Issue): string {
  const path = issue.path?.map(formatPathSegment).join(".");
  if (path === undefined || path.length === 0) {
    return issue.message;
  }
  return `${path}: ${issue.message}`;
}

function formatPathSegment(segment: StandardSchemaV1.PathSegment | PropertyKey): string {
  if (typeof segment === "object" && segment !== null && "key" in segment) {
    return String((segment as StandardSchemaV1.PathSegment).key);
  }
  return String(segment);
}
