
## Problem

When a service is added or its price changes, the `autoGeneratePayments` function has two code paths:

1. **Unpaid "final" exists** → converts it to deposit, adds new final ✓ (works correctly)
2. **No unpaid final exists** (e.g. all payments are deposits/installments, or all are paid) → redistributes amounts among unpaid payments ✗ (wrong — should add a new doplatek instead)

Additionally, the paid payments badge shows "Záloha" for all paid items, but the user wants paid items to keep their original label and the NEW payment to be explicitly labeled "Doplatek".

## Plan

### 1. Fix `autoGeneratePayments` in `src/pages/DealDetail.tsx` (lines ~1488–1517)

Replace the `else` branch (no unpaid final) with logic that:
- Calculates the remaining balance = `totalPrice - sum(ALL existing payments)`
- If remaining > 0.01 → inserts a **new** `payment_type: "final"` row labeled "Doplatek"
- Never modifies amounts of existing payments (paid or unpaid)
- If remaining ≤ 0 → does nothing (already fully covered)

```
NEW ELSE BRANCH:
  remaining = totalPrice - sum(all existing payments)
  if remaining > 0.01:
    INSERT new final payment { payment_type: "final", amount: remaining, notes: "Doplatek", due_date: departure-1month or +2months }
```

This also covers the case where all payments are paid — it will add a new doplatek for whatever is left.

### 2. Fix badge label in `src/components/DealPaymentSchedule.tsx` (line ~356)

Currently all paid payments show a green "Záloha" badge. Change this so:
- Paid payments show their actual type label ("Záloha", "Splátka", or "Doplatek")
- A `final` type paid payment shows "Doplatek" (green badge), not "Záloha"

```typescript
// Instead of always showing "Záloha":
{payment.paid && (
  <span className="...green badge...">
    {payment.payment_type === "final" ? "Doplatek" : "Záloha"}
  </span>
)}
```

### Files to edit
- `src/pages/DealDetail.tsx` — fix `autoGeneratePayments` else branch (lines ~1488–1517)
- `src/components/DealPaymentSchedule.tsx` — fix paid badge label (line ~356)

### Flow after fix
```
Service added/changed
  └─ autoGeneratePayments(dealId, newTotal)
       ├─ No payments yet → create 50% deposit + doplatek (unchanged)
       ├─ Unpaid final exists → convert to deposit, add new doplatek (unchanged, works)
       └─ No unpaid final (all deposits or all paid)
            └─ remaining = newTotal - sum(all payments)
                 ├─ remaining > 0 → INSERT new "final" / "Doplatek"
                 └─ remaining ≤ 0 → no action
```

The new doplatek syncs to `contract_payments` via the existing trigger `sync_deal_payment_to_contracts`, so it automatically appears in the contract payment schedule and in accounting.
