import { expect, test } from "bun:test";
import { classify } from "./herdr-workspace-namer";

test("keeps OMP's generated session title compact for the sidebar", () => {
	expect(classify("can we modify our herdr/omp connector to have better session renaming?", undefined).label)
		.toBe("modify-herdr-omp");
	expect(classify("", "Improve Herdr OMP Session Renaming")).toEqual({
		label: "improve-herdr-omp",
		lock: "adhoc",
	});
});
