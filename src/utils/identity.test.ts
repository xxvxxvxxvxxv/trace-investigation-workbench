import { expect, it, vi } from "vitest";
import { randomId } from "./identity";
it("creates valid distinct cryptographic v4 UUIDs without the secure-context convenience API", () => {
  const spy = vi
    .spyOn(crypto, "randomUUID")
    .mockImplementation(() => "00000000-0000-4000-8000-000000000000");
  const descriptor = Object.getOwnPropertyDescriptor(crypto, "randomUUID");
  Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
  try {
    const a = randomId(),
      b = randomId();
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(a).not.toBe(b);
  } finally {
    if (descriptor) Object.defineProperty(crypto, "randomUUID", descriptor);
    spy.mockRestore();
  }
});
