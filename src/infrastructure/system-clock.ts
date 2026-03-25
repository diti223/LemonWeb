import type { Clock } from "../domain/ports.ts";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
