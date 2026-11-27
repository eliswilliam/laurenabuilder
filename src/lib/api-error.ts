import { NextResponse } from "next/server";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

type ApiErrorOptions = {
  code?: string;
  details?: unknown;
  extra?: Record<string, unknown>;
  params?: Record<string, string | number>;
};

export type ApiErrorPayload = {
  ok: false;
  error: string;
  errorKey: string;
  code?: string;
  details?: unknown;
} & Record<string, unknown>;

export function buildApiErrorPayload(
  t: TranslateFn,
  errorKey: string,
  options: ApiErrorOptions = {}
): ApiErrorPayload {
  const { code, details, extra, params } = options;

  const payload: ApiErrorPayload = {
    ok: false,
    error: t(errorKey, params),
    errorKey,
    ...(code ? { code } : {}),
    ...(details !== undefined ? { details } : {}),
    ...(extra ?? {}),
  };

  return payload;
}

export function apiErrorResponse(
  t: TranslateFn,
  status: number,
  errorKey: string,
  options: ApiErrorOptions = {}
) {
  return NextResponse.json(buildApiErrorPayload(t, errorKey, options), { status });
}
