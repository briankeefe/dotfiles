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

test("names running execute tickets before OMP finishes the turn", () => {
	expect(classify("execute https://example.invalid/issue/DEMO-101/dashboard-enable-inline-editing-of-price-and-quantity", undefined)).toEqual({
		label: "inline-editing-price",
		lock: "ticket",
	});
	expect(classify("execute https://example.invalid/issue/DEMO-102/dashboard-inventory-add-stock-count", undefined)).toEqual({
		label: "stock-count",
		lock: "ticket",
	});
});

test("keeps ticket reviews distinct from development", () => {
	expect(classify("execute pr review https://example.invalid/issue/DEMO-101/task", undefined)).toEqual({
		label: "[review: DEMO-101]",
		lock: "review",
	});
});
