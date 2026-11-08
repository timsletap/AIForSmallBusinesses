export const INDUSTRIES = [
  { id: "restaurant", label: "Restaurant or diner", typicalSale: 25, saleWord: "order" },
  { id: "coffee_bakery", label: "Coffee shop or bakery", typicalSale: 10, saleWord: "order" },
  { id: "salon_barber", label: "Salon or barber", typicalSale: 45, saleWord: "appointment" },
  { id: "hvac_plumbing", label: "HVAC, plumbing or electrical", typicalSale: 250, saleWord: "service call" },
  { id: "landscaping", label: "Landscaping or lawn care", typicalSale: 120, saleWord: "job" },
  { id: "retail", label: "Retail store", typicalSale: 40, saleWord: "sale" },
  { id: "other", label: "Something else", typicalSale: 50, saleWord: "sale" },
] as const;

export type IndustryId = (typeof INDUSTRIES)[number]["id"];
export const INDUSTRY_IDS = INDUSTRIES.map((i) => i.id) as [IndustryId, ...IndustryId[]];
export const industryById = (id: string) => INDUSTRIES.find((i) => i.id === id);

/** Which industries the seed script searches for each use case. */
export const SEED_INDUSTRIES: Record<string, IndustryId[]> = {
  missed_calls: ["restaurant", "salon_barber", "hvac_plumbing"],
  booking_waitlist: ["salon_barber", "restaurant"],
  auto_replies: ["restaurant", "retail"],
  customer_list: ["retail", "hvac_plumbing"],
  win_back: ["salon_barber", "coffee_bakery", "hvac_plumbing"],
  scheduling_dispatch: ["hvac_plumbing", "landscaping"],
};
