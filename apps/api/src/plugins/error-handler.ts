import fp from "fastify-plugin";
import { ZodError } from "zod";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
};

export const errorHandlerPlugin = fp(async (app) => {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      request.log.info({ issues: error.issues }, "Validation failed.");

      return reply.code(400).send({
        message: "Validation failed.",
        errors: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    if (isRecord(error) && error.name === "NotFoundError") {
      return reply.code(404).send({ message: "Resource not found." });
    }

    if (isRecord(error) && typeof error.code === "string") {
      const meta = isRecord(error.meta) ? error.meta : null;

      if (error.code === "P2002") {
        const target = Array.isArray(meta?.target)
          ? meta.target.filter((field): field is string => typeof field === "string")
          : null;

        return reply.code(409).send({
          message: "A record with this value already exists.",
          ...(target && target.length > 0 ? { fields: target } : {})
        });
      }

      if (error.code === "P2003") {
        const field = typeof meta?.field_name === "string" ? meta.field_name : null;

        return reply.code(409).send({
          message: "This operation would violate a required relationship.",
          ...(field ? { field } : {})
        });
      }

      if (error.code === "P2014") {
        return reply.code(409).send({
          message: "This operation would break a required relationship between records."
        });
      }

      if (error.code === "P2025") {
        const cause = typeof meta?.cause === "string" ? meta.cause : null;

        return reply.code(404).send({
          message: cause ?? "Resource not found."
        });
      }
    }

    if (isRecord(error) && typeof error.statusCode === "number") {
      return reply.code(error.statusCode).send({
        message: getErrorMessage(error, "Request failed.")
      });
    }

    request.log.error({ err: error }, "Unhandled error.");

    return reply.code(500).send({
      message: "An unexpected error occurred.",
      ...(process.env.NODE_ENV !== "production" ? { detail: getErrorMessage(error, "Unknown error") } : {})
    });
  });
});