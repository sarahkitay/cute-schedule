import React, { useState } from "react";
import {
  appendWeeklyMenuMealToMacroLog,
  getWeeklyMenuFollowStatus,
  getWeeklyMenuMealsForDayKey,
  markWeeklyMenuMealSkipped,
  normalizeWeeklyMenu,
} from "../health/healthModel";

const SERVING_OPTIONS = [0.5, 1, 1.5, 2, 3];

export function TodayWeeklyMenu({ health, setHealth, dayKey, onOpenMacros }) {
  const wm = normalizeWeeklyMenu(health?.weeklyMenu);
  if (!wm.showOnHome) return null;
  const meals = getWeeklyMenuMealsForDayKey(health, dayKey);
  if (!meals.length) return null;

  const [servingsByMeal, setServingsByMeal] = useState({});

  function logMeal(meal) {
    const servings = servingsByMeal[meal.id] ?? 1;
    setHealth((prev) => appendWeeklyMenuMealToMacroLog(prev, dayKey, meal, servings));
  }

  return (
    <section className="today-section today-weekly-menu scroll-reveal" aria-label="Today's menu">
      <div className="panel-title today-weekly-menu-title">
        <span className="title">Today&apos;s menu</span>
        {onOpenMacros ? (
          <button type="button" className="btn btn-sm btn-ghost today-weekly-menu-open-macros" onClick={onOpenMacros}>
            Macro tracker
          </button>
        ) : null}
      </div>
      <ul className="today-weekly-menu-list">
        {meals.map((meal) => {
          const follow = getWeeklyMenuFollowStatus(health, dayKey, meal.id);
          const logServ = servingsByMeal[meal.id] ?? 1;
          return (
            <li key={meal.id} className={`today-weekly-menu-item surface-glass ${follow ? "is-followed" : ""}`}>
              <div className="today-weekly-menu-item-main">
                <div className="today-weekly-menu-slot">{meal.slot}</div>
                {meal.food ? <div className="health-subline">{meal.food}</div> : null}
                <div className="health-subline today-weekly-menu-macros">
                  P {meal.protein}g · C {meal.carbs}g · F {meal.fat}g · {meal.calories} kcal
                </div>
              </div>
              <div className="today-weekly-menu-item-actions">
                {follow === "logged" ? (
                  <span className="today-weekly-menu-status">Logged</span>
                ) : follow === "skipped" ? (
                  <span className="today-weekly-menu-status today-weekly-menu-status--skip">Skipped</span>
                ) : (
                  <>
                    <select
                      className="input today-weekly-menu-serving"
                      value={String(logServ)}
                      onChange={(e) => setServingsByMeal((prev) => ({ ...prev, [meal.id]: Number(e.target.value) }))}
                      aria-label={`Servings for ${meal.slot}`}
                    >
                      {SERVING_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {n === 0.5 ? "½" : n}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => logMeal(meal)}>
                      I had this
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setHealth((prev) => markWeeklyMenuMealSkipped(prev, dayKey, meal.id))}
                    >
                      Skip
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
