import pino from "pino";
import type { Logger } from "pino";

declare module "hono" {
  interface ContextVariableMap {
    reqId: string;
    logger: Logger;
  }
}

export const logger = pino(
  process.env.NODE_ENV === "development"
    ? { transport: { target: "pino-pretty", options: { colorize: true } } }
    : {}
);
