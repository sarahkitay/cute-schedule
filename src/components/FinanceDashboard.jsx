import React, { useMemo, useState } from "react";
import { RowMoreMenu } from "./RowMoreMenu";
import {
  FINANCE_PERIOD_OPTIONS,
  EXPENSE_CATEGORIES,
  aggregateFinancePeriod,
  budgetSpentInPeriod,
  donutGradientFromBreakdown,
  expenseCategoryLabel,
  formatFinanceMoney,
  formatTransactionDate,
} from "../financeDashboardHelpers";

const BUDGET_ICONS = {
  housing: "🏠",
  food: "🍽",
  transport: "🚗",
  shopping: "🛍",
  entertainment: "🎬",
  other: "📦",
};

export function FinanceDashboard({ finance, onRemoveEntry, onUpdateBudgets }) {
  const [periodId, setPeriodId] = useState("this_month");
  const [showAllTx, setShowAllTx] = useState(false);
  const [budgetsOpen, setBudgetsOpen] = useState(false);
  const [newBudgetCategory, setNewBudgetCategory] = useState("housing");
  const [newBudgetLimit, setNewBudgetLimit] = useState("");

  const agg = useMemo(() => aggregateFinancePeriod(finance, periodId), [finance, periodId]);
  const budgets = finance.budgets || [];
  const txLimit = showAllTx ? 50 : 4;
  const donutBg = donutGradientFromBreakdown(agg.breakdown, agg.expenseTotal);

  function addBudget(e) {
    e.preventDefault();
    const limit = parseFloat(String(newBudgetLimit).replace(",", "."));
    if (!Number.isFinite(limit) || limit <= 0) return;
    const exists = budgets.some((b) => b.category === newBudgetCategory);
    if (exists) return;
    const next = [
      ...budgets,
      {
        id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        category: newBudgetCategory,
        limit,
      },
    ];
    onUpdateBudgets(next);
    setNewBudgetLimit("");
    setBudgetsOpen(false);
  }

  function removeBudget(id) {
    onUpdateBudgets(budgets.filter((b) => b.id !== id));
  }

  return (
    <div className="finance-dashboard">
      <div className="finance-period-tabs" role="tablist" aria-label="Finance time period">
        {FINANCE_PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={periodId === opt.id}
            className={`finance-period-tab${periodId === opt.id ? " finance-period-tab--active" : ""}`}
            onClick={() => {
              setPeriodId(opt.id);
              setShowAllTx(false);
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <section className="finance-dash-section surface-glass">
        <h3 className="finance-dash-heading">Overview</h3>
        <div className="finance-month-snapshot finance-month-snapshot--dash">
          <div className="finance-month-stat finance-month-stat--income">
            <span className="finance-month-stat-label">Income</span>
            <span className="finance-month-stat-value">{formatFinanceMoney(agg.incomeTotal, { signed: true, type: "income" })}</span>
          </div>
          <div className="finance-month-stat finance-month-stat--expense">
            <span className="finance-month-stat-label">Spent</span>
            <span className="finance-month-stat-value">{formatFinanceMoney(agg.expenseTotal, { signed: true, type: "expense" })}</span>
          </div>
          <div className="finance-month-stat finance-month-stat--net">
            <span className="finance-month-stat-label">Net</span>
            <span className="finance-month-stat-value">
              {formatFinanceMoney(agg.netTotal, { signed: true, type: agg.netTotal >= 0 ? "income" : "expense" })}
            </span>
          </div>
        </div>
      </section>

      {agg.expenseTotal > 0 && (
        <section className="finance-dash-section surface-glass">
          <h3 className="finance-dash-heading">Spending breakdown</h3>
          <div className="finance-breakdown">
            <div className="finance-donut-wrap" aria-hidden="true">
              <div className="finance-donut" style={{ background: donutBg }}>
                <div className="finance-donut-hole">
                  <span className="finance-donut-total">{formatFinanceMoney(agg.expenseTotal)}</span>
                  <span className="finance-donut-label">Total</span>
                </div>
              </div>
            </div>
            <ul className="finance-breakdown-legend">
              {agg.breakdown.map((row) => (
                <li key={row.id} className="finance-breakdown-row">
                  <span className="finance-breakdown-dot" style={{ background: row.color }} />
                  <span className="finance-breakdown-name">{row.label}</span>
                  <span className="finance-breakdown-amt">{formatFinanceMoney(row.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="finance-dash-section surface-glass">
        <div className="finance-dash-section-head">
          <h3 className="finance-dash-heading">Recent transactions</h3>
          {agg.transactions.length > 4 && (
            <button type="button" className="finance-dash-link" onClick={() => setShowAllTx((v) => !v)}>
              {showAllTx ? "Show less" : "See all"}
            </button>
          )}
        </div>
        {agg.transactions.length === 0 ? (
          <p className="finance-dash-empty">No transactions in this period yet. Use the box above to log income or spending.</p>
        ) : (
          <ul className="finance-tx-list">
            {agg.transactions.slice(0, txLimit).map((tx) => (
              <li key={`${tx.type}-${tx.id}`} className={`finance-tx-item finance-tx-item--${tx.type}`}>
                <span className={`finance-tx-icon finance-tx-icon--${tx.type}`} aria-hidden="true">
                  {tx.type === "income" ? "↓" : "↑"}
                </span>
                <div className="finance-tx-body">
                  <span className="finance-tx-title">{tx.label}</span>
                  <span className="finance-tx-date">{formatTransactionDate(tx.dateISO)}</span>
                </div>
                <span className={`finance-tx-amount finance-tx-amount--${tx.type}`}>
                  {formatFinanceMoney(tx.amount, { signed: true, type: tx.type })}
                </span>
                <RowMoreMenu
                  ariaLabel={`${tx.label} options`}
                  deleteLabel="Delete"
                  onDelete={() => onRemoveEntry(tx.type, tx.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="finance-dash-section surface-glass">
        <div className="finance-dash-section-head">
          <h3 className="finance-dash-heading">Budgets</h3>
          <button type="button" className="finance-dash-link" onClick={() => setBudgetsOpen((v) => !v)}>
            {budgetsOpen ? "Done" : "Manage"}
          </button>
        </div>
        {budgets.length === 0 && !budgetsOpen && (
          <p className="finance-dash-empty">No budgets yet. Tap Manage to set a monthly limit by category.</p>
        )}
        {budgetsOpen && (
          <form className="finance-budget-add-form" onSubmit={addBudget}>
            <select className="input" value={newBudgetCategory} onChange={(e) => setNewBudgetCategory(e.target.value)} aria-label="Budget category">
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id} disabled={budgets.some((b) => b.category === c.id)}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              className="input"
              type="number"
              min="1"
              step="0.01"
              value={newBudgetLimit}
              onChange={(e) => setNewBudgetLimit(e.target.value)}
              placeholder="Monthly limit"
              aria-label="Budget limit"
            />
            <button type="submit" className="btn btn-primary" disabled={!newBudgetLimit.trim()}>
              Add
            </button>
          </form>
        )}
        <ul className="finance-budget-list">
          {budgets.map((b) => {
            const spent = budgetSpentInPeriod(b, finance, periodId);
            const limit = Number(b.limit) || 0;
            const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
            const cat = b.category || "other";
            return (
              <li key={b.id} className="finance-budget-item">
                <span className="finance-budget-icon" aria-hidden="true">
                  {BUDGET_ICONS[cat] || "📦"}
                </span>
                <div className="finance-budget-body">
                  <div className="finance-budget-top">
                    <span className="finance-budget-name">{expenseCategoryLabel(cat)}</span>
                    <span className="finance-budget-pct">{pct}%</span>
                    {budgetsOpen && (
                      <RowMoreMenu ariaLabel="Budget options" deleteLabel="Remove budget" onDelete={() => removeBudget(b.id)} />
                    )}
                  </div>
                  <span className="finance-budget-meta">
                    {formatFinanceMoney(spent)} of {formatFinanceMoney(limit)}
                  </span>
                  <div className="finance-budget-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <div className="finance-budget-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <span className="finance-budget-chevron" aria-hidden="true">
                  ›
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
