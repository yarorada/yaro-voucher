/**
 * Calculate the total price for a service based on its price_mode.
 * - "per_person": price × person_count
 * - "per_service" (default/fallback): price × quantity
 */
export function getServiceTotal(service: {
  price?: number | null;
  quantity?: number | null;
  person_count?: number | null;
  details?: any;
}): number {
  const price = service.price || 0;
  const priceMode = service.details?.price_mode || "per_service";
  const multiplier = priceMode === "per_person"
    ? (service.person_count || 1)
    : (service.quantity || 1);
  return price * multiplier;
}

/**
 * Get the multiplier value for a service based on its price_mode.
 */
export function getServiceMultiplier(service: {
  quantity?: number | null;
  person_count?: number | null;
  details?: any;
}): number {
  const priceMode = service.details?.price_mode || "per_service";
  return priceMode === "per_person"
    ? (service.person_count || 1)
    : (service.quantity || 1);
}

/**
 * Calculate the total cost price for a service based on its price_mode.
 */
export function getServiceCostTotal(service: {
  cost_price?: number | null;
  quantity?: number | null;
  person_count?: number | null;
  details?: any;
}): number {
  const cost = service.cost_price || 0;
  const priceMode = service.details?.price_mode || "per_service";
  const multiplier = priceMode === "per_person"
    ? (service.person_count || 1)
    : (service.quantity || 1);
  return cost * multiplier;
}
