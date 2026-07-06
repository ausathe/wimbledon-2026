import { defineConfig } from "vitest/config";

/* Unit-test config for the fixture-testable pure logic in src/live/**
   (parse/reconcile/scoreboard-signature) plus src/bracket/model.ts helpers.
   No browser/DOM needed -- these modules are framework-free by design. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
