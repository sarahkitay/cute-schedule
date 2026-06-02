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

test("parseNutritionLabelText handles jumbled two-column OCR (pretzel label)", () => {
  const text = `1% 0% 0% 17% 8% 7% 0% 0% 0% 2%
110 % Daily Value*
Nutrition Facts Serving size 1 oz (28g/about 16 pretzels) Includes 0g Added Sugars
8 servings per container Polyunsaturated Fat 0g Monounsaturated Fat 0g Total Carbohydrate 23g
Amount per serving Saturated Fat 0g Cholesterol Omg Dietary Fiber 2g Total Sugars <1g Vitamin D 0mcg Calcium 0mg
Calories Trans Fat 0g Sodium 400mg Protein 3g Iron 0.4mg
Total Fat 0.5g`;
  const { macros, confidence } = parseNutritionLabelText(text);
  assert.ok(macros);
  assert.equal(macros.calories, 110);
  assert.equal(macros.protein, 3);
  assert.equal(macros.carbs, 23);
  assert.equal(macros.fat, 1);
  assert.ok(confidence === "high" || confidence === "medium");
});

test("parseNutritionLabelText handles jumbled OCR without calorie digit (fiber label)", () => {
  const text = `Total Carbohydrate 42g Soluble Fiber 2g Insoluble Fiber 1g
Saturated Fat 0g Dietary Fiber 3g Total Sugars 1g
Serving size Amount Per Serving Calories Trans Fat 0g Cholesterol 0mg
Total Fat 1g Sodium 0mg Protein 7g`;
  const { macros, confidence } = parseNutritionLabelText(text);
  assert.ok(macros);
  assert.equal(macros.protein, 7);
  assert.equal(macros.fat, 1);
  assert.equal(macros.carbs, 42);
  assert.ok(macros.calories >= 200 && macros.calories <= 210);
  assert.ok(confidence === "high" || confidence === "medium");
});

test("scaleLabelMacrosForPortion by servings and cups", () => {
  const base = { calories: 200, protein: 10, carbs: 20, fat: 5, servingSize: "2/3 cup (55g)" };
  const two = scaleLabelMacrosForPortion(base, 2, "servings");
  assert.equal(two.calories, 400);
  assert.equal(two.protein, 20);
  const oneCup = scaleLabelMacrosForPortion(base, 1, "cups");
  assert.equal(oneCup.calories, 300);
});
