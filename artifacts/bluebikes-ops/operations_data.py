"""Load and summarize the compact Bluebikes planning exports."""

from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd


DATA_DIR = Path(__file__).resolve().parents[2] / "artifacts" / "api-server" / "data"
CREW_MONTH_CAPACITY = 704


@lru_cache(maxsize=1)
def load_operations_data() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    files = (
        "2026_monthly_staffing_plan.csv",
        "2026_backtest_jan_sep.csv",
        "2026_sensitivity_scenarios.csv",
    )
    missing = [name for name in files if not (DATA_DIR / name).is_file()]
    if missing:
        raise FileNotFoundError(
            f"Missing planning data in {DATA_DIR}: {', '.join(missing)}"
        )

    staffing, backtest, sensitivity = (
        pd.read_csv(DATA_DIR / name) for name in files
    )
    return staffing, backtest, sensitivity


def city_names() -> list[str]:
    staffing, _, _ = load_operations_data()
    return sorted(staffing["city"].dropna().astype(str).unique().tolist())


def filter_rows(
    frame: pd.DataFrame,
    city: str | None = None,
    month: int | None = None,
) -> pd.DataFrame:
    rows = frame
    if city:
        rows = rows[rows["city"].str.casefold() == city.casefold()]
    if month is not None:
        rows = rows[rows["month"] == month]
    return rows.copy()


def get_overview() -> dict[str, Any]:
    staffing, backtest, _ = load_operations_data()
    monthly_crews = staffing.groupby("month")["total_crews_needed"].sum()
    peak_month = int(monthly_crews.idxmax()) if not monthly_crews.empty else 0
    month_name = (
        staffing.loc[staffing["month"] == peak_month, "month_name"].iloc[0]
        if peak_month
        else "—"
    )

    actual_trips = float(backtest["actual_trip_starts"].sum())
    actual_imbalance = float(backtest["actual_rebalance_proxy_bikes"].sum())
    trip_wape = (
        float(
            (backtest["forecast_trip_starts"] - backtest["actual_trip_starts"])
            .abs()
            .sum()
            / actual_trips
            * 100
        )
        if actual_trips
        else 0.0
    )
    imbalance_wape = (
        float(
            (
                backtest["forecast_rebalance_proxy_bikes"]
                - backtest["actual_rebalance_proxy_bikes"]
            )
            .abs()
            .sum()
            / actual_imbalance
            * 100
        )
        if actual_imbalance
        else 0.0
    )

    return {
        "city_count": staffing["city"].nunique(),
        "total_crew_months": int(staffing["total_crews_needed"].sum()),
        "seasonal_crew_months": int(staffing["seasonal_crews"].sum()),
        "peak_crew_count": int(monthly_crews.max()) if not monthly_crews.empty else 0,
        "peak_month": month_name,
        "trip_wape_pct": trip_wape,
        "imbalance_wape_pct": imbalance_wape,
        "forecast_trip_starts": int(staffing["forecast_trip_starts"].sum()),
        "actual_through": "September 2026",
        "data_quality_note": (
            "Forecasts are city-month estimates. The station-week positive-net-inflow "
            "measure is a rebalancing proxy, not a count of observed van moves. "
            "Station-name matching omitted 1.87% of start endpoints and 1.98% of "
            "end endpoints from city assignment."
        ),
        "assumptions": [
            "Trip demand uses the average for the same calendar month in 2024 and 2025.",
            "The rebalance proxy sums positive station net inflow by city-week and scales it to a month.",
            "One crew is provisionally modeled at 32 bike moves per workday across 22 workdays (704 moves/month).",
            "Full-time staffing is the annual minimum for each city; seasonal crews cover the monthly peak.",
            "Seasonal hiring lead time is two months. Event uplift is zero until event effects are calibrated.",
            "Wages, hiring costs, and lost-trip revenue were not supplied, so no dollar cost or revenue estimate is claimed.",
        ],
    }


def records_json(frame: pd.DataFrame, limit: int = 50) -> str:
    """Return JSON-safe rows for tool responses."""
    safe = frame.head(limit).astype(object).where(pd.notna(frame.head(limit)), None)
    return safe.to_json(orient="records", date_format="iso")
