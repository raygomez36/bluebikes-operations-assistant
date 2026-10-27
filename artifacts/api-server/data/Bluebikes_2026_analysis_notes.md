# Bluebikes 2026 demand, staffing & backtest

## What the model says

The 2024–25 same-calendar-month baseline estimates **4,570,767 2026 trip starts** and **124,716 monthly-equivalent bike moves in the station-imbalance proxy** across the 13 municipalities in the station list. Under the illustrative capacity setting below, the plan carries **18 full-time crews** across municipalities plus up to **12 seasonal crews** at the October peak (**30 total crews**).

For Boston, the model assigns **5 full-time crews year-round**, with seasonal staffing rising to **8 additional crews in October** (13 total). The staffing table uses the demand baseline—not the e-bike high-growth sensitivity—as its baseline plan.

| Month | Forecast trips | Rebalance proxy bikes | Full-time | Seasonal | Total crews | Seasonal hire-by |
|---|---:|---:|---:|---:|---:|---|
| January | 82,821 | 3,355 | 5 | 0 | 5 | — |
| February | 95,562 | 4,234 | 5 | 2 | 7 | 2025-12 |
| March | 136,281 | 5,003 | 5 | 3 | 8 | 2026-01 |
| April | 192,621 | 6,106 | 5 | 4 | 9 | 2026-02 |
| May | 231,945 | 7,084 | 5 | 6 | 11 | 2026-03 |
| June | 272,097 | 6,908 | 5 | 5 | 10 | — |
| July | 302,100 | 6,998 | 5 | 5 | 10 | — |
| August | 304,674 | 8,107 | 5 | 7 | 12 | 2026-06 |
| September | 318,796 | 8,030 | 5 | 7 | 12 | — |
| October | 295,498 | 8,616 | 5 | 8 | 13 | 2026-08 |
| November | 198,408 | 6,991 | 5 | 5 | 10 | — |
| December | 101,110 | 3,919 | 5 | 1 | 6 | — |

## Jan–Sep 2026 backtest

The seasonal baseline's weighted absolute percentage error (WAPE) was **9.2% for city-level trip starts** and **19.6% for the imbalance proxy** across 117 city-month observations. Against planned crew capacity, the actual imbalance proxy exceeded plan by **10,473 bike-move units** across the backtest. The largest city totals were Boston (8,922), Cambridge (1,509), and Brookline (42); proxy shortfalls were concentrated in Jul 2,839, Jun 2,696, May 2,252, Apr 1,564, Aug 1,122.

These are **modeled capacity gaps**, not verified station outages, failed rentals/returns, or lost revenue.

## Method & operating assumptions

- Forecast: for each municipality and calendar month, average of the 2024 and 2025 monthly trip starts and imbalance proxy.
- Imbalance proxy: station-level weekly arrivals minus departures; sum positive station net inflow within a municipality for each week, average weekly value, and scale by 4.345 weeks/month. This is not a record of actual van moves.
- Crew capacity: **32 bike moves per crew per workday × 22 workdays = 704 moves per crew-month**. This is an editable placeholder, not a measured Bluebikes productivity rate.
- Staffing rule: full-time baseline is each city's lowest forecast monthly crew requirement; seasonal crews fill the monthly peak above that floor. Seasonal hiring lead time is set to **two months**.
- Events and weather: no event source text or weather dataset was provided. Event uplift is **0%**; the event extraction cell is ready but no event claims were inserted into this forecast.
- Cost and revenue: not calculated. Crew wage/contract costs and observed failed-trip or lost-revenue data were not supplied.

## Sensitivity

| Scenario | Crew-months across 13 municipalities |
|---|---:|
| Ridership −20% | 264 |
| Baseline | 296 |
| Ridership +20% | 326 |
| E-bike share 55% | 302 |

E-bike share in mapped trip starts rose from **25.4% in 2024** to **28.5% in 2025** and **31.9% in Jan–Sep 2026**. The high-share case sets mix to 55% and applies a **10% extra handling-time factor only to the share increase above the 2024–25 city/month mix**. That handling factor is an assumption, not an empirically estimated e-bike effect.

## Data-quality limits / next calibration

There were **12,893,499 trip records with valid start times**. Exact normalized station-name matching to the 2026 station list left **1.87% of starts and 1.98% of ends without a municipality**; known endpoints were retained independently, but unmatched endpoints are omitted from city totals. A station alias/lifecycle table or coordinate-based review could improve this. Before using the crew numbers operationally, replace the placeholder throughput, hiring lead time, wages, contract rules, and e-bike handling factor with operating data; then add daily weather and verified event dates/crowd sources and measure their impacts against trip demand.
