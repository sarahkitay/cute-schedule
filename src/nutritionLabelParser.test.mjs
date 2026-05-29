import test from "node:test";
import assert from "node:assert/strict";
import { parseNutritionLabelText, scaleLabelMacrosForPortion } from "./nutritionLabelParser.js";

test("parseNutritionLabelText reads standard FDA panel layout", () => {
  const text = `
Nutrition Facts
Serving size 2/3 cup (55g)
Calories 230
Total Fat 8g
Saturated Fat 1g
Total Carbohydrate 37g
Dietary Fiber 4g
Protein 3g
`;
  const { macros, confidence } = parseNutritionLabelText(text);
  assert.ok(macros);
  assert.equal(macros.calories, 230);
  assert.equal(macros.fat, 8);
  assert.equal(macros.carbs, 37);
  assert.equal(macros.protein, 3);
  assert.equal(confidence, "high");
});

test("scaleLabelMacrosForPortion by servings and cups", () => {
  const base = { calories: 200, protein: 10, carbs: 20, fat: 5, servingSize: "2/3 cup (55g)" };
  const two = scaleLabelMacrosForPortion(base, 2, "servings");
  assert.equal(two.calories, 400);
  assert.equal(two.protein, 20);
  const oneCup = scaleLabelMacrosForPortion(base, 1, "cups");
  assert.equal(oneCup.calories, 300);
});
