import { registerOTel } from "@vercel/otel"
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base"

export function register() {
  registerOTel({
    serviceName: "miaomo.ai",
    spanProcessors: [
      "auto",
      // new SimpleSpanProcessor(new ConsoleSpanExporter()),
    ],
  })
}
