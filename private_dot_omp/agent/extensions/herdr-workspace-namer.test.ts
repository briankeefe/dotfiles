import { expect, test } from "bun:test";
import { classify } from "./herdr-workspace-namer";

test("replaces the prompt slug with OMP's generated session title", () => {
	expect(classify("can we modify our herdr/omp connector to have better session renaming?", undefined).label)
		.toBe("modify-herdr-omp-connector-have");
	expect(classify("", "Improve Herdr OMP Session Renaming")).toEqual({
		label: "Improve Herdr OMP Session Renaming",
		lock: "adhoc",
	});
});
