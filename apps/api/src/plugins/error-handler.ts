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

    if (isRecord(error) && error.code === "P2002") {
      const meta = isRecord(error.meta) ? error.meta : null;
      const target = Array.isArray(meta?.target)
        ? meta.target.filter((field): field is string => typeof field === "string")
        : null;

      return reply.code(409).send({
        message: "A record with this value already exists.",
        ...(target && target.length > 0 ? { fields: target } : {})
      });
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