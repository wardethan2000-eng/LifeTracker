import type { FastifyReply } from "fastify";

/**
 * Send a 404 Not Found response.
 * @param reply - Fastify reply instance
 * @param entity - Human-readable entity name (e.g. "Asset", "Project")
 *                 Produces `"${entity} not found."` as the message.
 */
export function notFound(reply: FastifyReply, entity: string) {
  return reply.code(404).send({ message: `${entity} not found.` });
}

/**
 * Send a 403 Forbidden response.
 * @param reply   - Fastify reply instance
 * @param message - Optional override. Defaults to the standard household-access message.
 */
export function forbidden(
  reply: FastifyReply,
  message = "You do not have access to this household."
) {
  return reply.code(403).send({ message });
}

/**
 * Send a 400 Bad Request response.
 * @param reply   - Fastify reply instance
 * @param message - Human-readable reason for the rejection
 */
export function badRequest(reply: FastifyReply, message: string) {
  return reply.code(400).send({ message });
}
