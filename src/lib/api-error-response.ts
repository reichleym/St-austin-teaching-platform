import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { PermissionError } from "@/lib/permissions";

type ApiErrorShape = {
  error: string;
  errorCode?: string;
  debug?: string;
};

type PublicError = {
  status: number;
  message: string;
  code?: string;
  debug?: string;
};

function isDevelopment() {
  return process.env.NODE_ENV === "development";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

function redactPrismaInvocationNoise(message: string) {
  // Prisma often prefixes errors with "Invalid `prisma.<method>()` invocation:" which is not meaningful to users.
  const normalized = message.trimStart();
  return normalized
    .replace(/^\s*Invalid `prisma\.[^`]+` invocation:\s*/i, "")
    .replace(/^\s*Invalid `prisma\.[^`]+` invocation:\s*\n+/i, "")
    .trim();
}

function toPublicPrismaError(error: unknown): PublicError | null {
  const message = redactPrismaInvocationNoise(getErrorMessage(error));

  // Known request errors (constraint violations, missing records, etc.)
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const code = error.code;

    // Raw query failures often surface as P2010 with an embedded SQLSTATE.
    // Example: "Raw query failed. Code: `28000`. Message: `role \"st_austin\" does not exist`"
    if (code === "P2010" || message.toLowerCase().includes("raw query failed")) {
      const roleMatch = message.match(/role\s+"([^"]+)"\s+does\s+not\s+exist/i);
      if (roleMatch) {
        const role = roleMatch[1];
        return {
          status: 503,
          code: "DB_AUTH_ROLE_MISSING",
          message: "Server setup error: database login is misconfigured. Please contact support.",
          debug: isDevelopment() ? message : undefined,
        };
      }

      if (message.match(/code:\s*`?28000`?/i) || message.toLowerCase().includes("authentication failed")) {
        return {
          status: 503,
          code: "DB_AUTH_FAILED",
          message: "Server setup error: database login failed. Please contact support.",
          debug: isDevelopment() ? message : undefined,
        };
      }
    }

    if (code === "P2002") {
      return { status: 409, message: "This already exists. Try using a different value.", code };
    }

    if (code === "P2025") {
      return { status: 404, message: "The requested record was not found.", code };
    }

    // Fallback for known Prisma errors.
    return {
      status: 400,
      message: "Unable to process your request.",
      code,
      debug: isDevelopment() ? message : undefined,
    };
  }

  // Initialization / connectivity issues.
  if (error instanceof Prisma.PrismaClientInitializationError) {
    // Example: Postgres auth problems include SQLSTATE 28000 (invalid authorization specification).
    const roleMatch = message.match(/role\s+"([^"]+)"\s+does\s+not\s+exist/i);
    if (roleMatch) {
      const role = roleMatch[1];
      return {
        status: 503,
        code: "DB_AUTH_ROLE_MISSING",
        message: "Server setup error: database login is misconfigured. Please contact support.",
        debug: isDevelopment() ? message : undefined,
      };
    }

    if (message.toLowerCase().includes("authentication failed") || message.toLowerCase().includes("password")) {
      return {
        status: 503,
        code: "DB_AUTH_FAILED",
        message: "Server setup error: database login failed. Please contact support.",
        debug: isDevelopment() ? message : undefined,
      };
    }

    return {
      status: 503,
      code: "DB_UNAVAILABLE",
      message: "Service is temporarily unavailable. Please try again shortly.",
      debug: isDevelopment() ? message : undefined,
    };
  }

  // Many raw/driver errors are surfaced as plain Error messages.
  if (message) {
    const roleMatch = message.match(/role\s+"([^"]+)"\s+does\s+not\s+exist/i);
    if (roleMatch) {
      const role = roleMatch[1];
      return {
        status: 503,
        code: "DB_AUTH_ROLE_MISSING",
        message: "Server setup error: database login is misconfigured. Please contact support.",
        debug: isDevelopment() ? message : undefined,
      };
    }

    if (
      message.toLowerCase().includes("connect econnrefused") ||
      message.toLowerCase().includes("econnrefused") ||
      message.toLowerCase().includes("timeout") ||
      message.toLowerCase().includes("could not connect") ||
      message.toLowerCase().includes("connection terminated")
    ) {
      return {
        status: 503,
        code: "DB_UNAVAILABLE",
        message: "Service is temporarily unavailable. Please try again shortly.",
        debug: isDevelopment() ? message : undefined,
      };
    }
  }

  return null;
}

function toPublicError(error: unknown, fallbackMessage: string): PublicError {
  if (error instanceof PermissionError) {
    return { status: error.status, message: error.message, code: "PERMISSION_ERROR" };
  }

  const prismaPublic = toPublicPrismaError(error);
  if (prismaPublic) return prismaPublic;

  const message = getErrorMessage(error);
  return {
    status: 500,
    message: fallbackMessage,
    debug: isDevelopment() && message ? message : undefined,
  };
}

export function getPublicApiError(error: unknown, options?: { fallbackMessage?: string }) {
  const fallbackMessage = options?.fallbackMessage ?? "Something went wrong. Please try again.";
  return toPublicError(error, fallbackMessage);
}

export function apiErrorResponse(error: unknown, options?: { fallbackMessage?: string }) {
  const fallbackMessage = options?.fallbackMessage ?? "Something went wrong. Please try again.";
  const publicError = toPublicError(error, fallbackMessage);

  const payload: ApiErrorShape = { error: publicError.message };
  if (publicError.code) payload.errorCode = publicError.code;
  if (publicError.debug) payload.debug = publicError.debug;

  return NextResponse.json(payload, { status: publicError.status });
}
