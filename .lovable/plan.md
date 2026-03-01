
## Fix: Show orderer in parentheses in deal list view

### Problem
In the deals list (`Deals.tsx`), each deal row shows a description like:
`Jméno • ISO • Hotel • Datum`

When the orderer (lead traveler) is different from the first traveler, their name should appear in parentheses at the end — matching the auto-generated deal name format used in `DealDetail.tsx`.

### Root Cause
The `displayDesc` building logic in `Deals.tsx` only shows the lead client's name but never appends the orderer in parentheses. Also, `order_index` is not fetched for travelers, making it impossible to distinguish "first traveler by order" from the "orderer (lead)".

### Changes Required

**`src/pages/Deals.tsx`**

1. **Query** — Add `order_index` and `client_id` to the `deal_travelers` select in `fetchDeals`.

2. **Interface** — Add `order_index?: number` and `client_id: string` to the `deal_travelers` type in the `Deal` interface.

3. **Display logic** — Update the block that builds `displayDesc` (lines 488–508):
   - Find the orderer: the traveler with `is_lead_traveler = true`
   - Find the first traveler: traveler with the lowest `order_index`
   - If orderer ≠ first traveler (different `client_id`), append `(Jméno Příjmení)` to the end of `displayDesc`

### Result
Deal list rows will display:
- Same person: `Pavel Kadlic • TUR • Cornelia Diamond • 03-03-26`
- Different orderer: `Pavel Kadlic • TUR • Cornelia Diamond • 03-03-26 (Roman Partl)`
