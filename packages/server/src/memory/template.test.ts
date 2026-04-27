import { describe, expect, it } from "vitest";
import { interpolate } from "./template.js";

describe("interpolate", () => {
	it("replaces a top-level variable", () => {
		expect(interpolate("hello {{name}}", { name: "world" })).toBe("hello world");
	});

	it("replaces nested keys with dot syntax", () => {
		expect(interpolate("voice: {{client.brand_voice}}", { client: { brand_voice: "tight" } })).toBe(
			"voice: tight",
		);
	});

	it("leaves missing keys as empty string", () => {
		expect(interpolate("a {{nope}} b", {})).toBe("a  b");
	});

	it("supports underscore-prefixed namespaces", () => {
		const ctx = { client_profile: { brand_voice: "data-driven" } };
		expect(interpolate("{{client_profile.brand_voice}}", ctx)).toBe("data-driven");
	});
});
