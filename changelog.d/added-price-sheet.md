- `PriceSheet`, an optional page that lists each tool a patron can call with
  what it does and its live fare from the pricing model, grouped by fare. It
  also shows how long a tranche of credit lasts: N days, never, or not set yet.
  It is styled by `price-sheet.css` using only the theme tokens, so it looks
  the same at every operator and still takes each site's palette and fonts.
  `priceSheet()` gives the same reading without React. `PricingModelResult`
  now types the wheel's `expiration` field.
