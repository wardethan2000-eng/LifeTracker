import QRCode from "qrcode";
import type { FastifyReply } from "fastify";

export async function sendQrCode(
  reply: FastifyReply,
  content: string,
  options: { format: "png" | "svg"; size: number }
): Promise<void> {
  if (options.format === "svg") {
    const svg = await QRCode.toString(content, {
      type: "svg",
      width: options.size,
      margin: 1
    });

    reply
      .header("content-type", "image/svg+xml; charset=utf-8")
      .send(svg);
    return;
  }

  const png = await QRCode.toBuffer(content, {
    type: "png",
    width: options.size,
    margin: 1
  });

  reply
    .header("content-type", "image/png")
    .send(png);
}
