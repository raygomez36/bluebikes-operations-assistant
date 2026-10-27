import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

export type StaffingRow = {
  month: number;
  monthName: string;
  city: string;
  forecastTripStarts: number;
  forecastRebalanceProxyBikes: number;
  totalCrewsNeeded: number;
  fullTimeCrews: number;
  seasonalCrews: number;
  seasonalHires: number;
  seasonalReleases: number;
  hireBy: string | null;
  contractNote: string;
};

export type BacktestRow = {
  month: number;
  city: string;
  forecastTripStarts: number;
  actualTripStarts: number;
  tripForecastErrorPct: number;
  forecastRebalanceProxyBikes: number;
  actualRebalanceProxyBikes: number;
  imbalanceForecastErrorPct: number;
  plannedCrews: number;
  crewsImpliedByActualProxy: number;
  crewShortfallProxy: number;
  plannedCapacityBikes: number;
  capacityShortfallProxyBikes: number;
};

export type SensitivityRow = {
  scenario: string;
  month: number;
  city: string;
  historicalEbikeShare: number;
  ebikeShareScenario: number;
  imbalanceBikes: number;
  requiredCrews: number;
};

export type OperationsData = {
  staffing: StaffingRow[];
  backtest: BacktestRow[];
  sensitivity: SensitivityRow[];
};

type CsvValue = string | number | null;
type CsvRow = Record<string, CsvValue>;

function castCsvValue(value: string): CsvValue {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

async function readCsv(filename: string): Promise<CsvRow[]> {
  const csvPath = path.join(process.cwd(), "data", filename);
  const content = await readFile(csvPath, "utf8");
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    cast: (value: string) => castCsvValue(value),
  }) as CsvRow[];
}

function numberField(row: CsvRow, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid numeric value in operations data: ${key}`);
  }
  return value;
}

function stringField(row: CsvRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string") {
    throw new Error(`Invalid text value in operations data: ${key}`);
  }
  return value;
}

let dataPromise: Promise<OperationsData> | undefined;

export function getOperationsData(): Promise<OperationsData> {
  dataPromise ??= Promise.all([
    readCsv("2026_monthly_staffing_plan.csv"),
    readCsv("2026_backtest_jan_sep.csv"),
    readCsv("2026_sensitivity_scenarios.csv"),
  ]).then(([staffingRows, backtestRows, sensitivityRows]) => ({
    staffing: staffingRows.map((row) => ({
      month: numberField(row, "month"),
      monthName: stringField(row, "month_name"),
      city: stringField(row, "city"),
      forecastTripStarts: numberField(row, "forecast_trip_starts"),
      forecastRebalanceProxyBikes: numberField(
        row,
        "forecast_rebalance_proxy_bikes",
      ),
      totalCrewsNeeded: numberField(row, "total_crews_needed"),
      fullTimeCrews: numberField(row, "full_time_crews"),
      seasonalCrews: numberField(row, "seasonal_crews"),
      seasonalHires: numberField(row, "seasonal_hires"),
      seasonalReleases: numberField(row, "seasonal_releases"),
      hireBy: typeof row.hire_by === "string" ? row.hire_by : null,
      contractNote:
        typeof row.contract_note === "string" ? row.contract_note : "",
    })),
    backtest: backtestRows.map((row) => ({
      month: numberField(row, "month"),
      city: stringField(row, "city"),
      forecastTripStarts: numberField(row, "forecast_trip_starts"),
      actualTripStarts: numberField(row, "actual_trip_starts"),
      tripForecastErrorPct: numberField(row, "trip_forecast_error_pct"),
      forecastRebalanceProxyBikes: numberField(
        row,
        "forecast_rebalance_proxy_bikes",
      ),
      actualRebalanceProxyBikes: numberField(
        row,
        "actual_rebalance_proxy_bikes",
      ),
      imbalanceForecastErrorPct: numberField(
        row,
        "imbalance_forecast_error_pct",
      ),
      plannedCrews: numberField(row, "planned_crews"),
      crewsImpliedByActualProxy: numberField(
        row,
        "crews_implied_by_actual_proxy",
      ),
      crewShortfallProxy: numberField(row, "crew_shortfall_proxy"),
      plannedCapacityBikes: numberField(row, "planned_capacity_bikes"),
      capacityShortfallProxyBikes: numberField(
        row,
        "capacity_shortfall_proxy_bikes",
      ),
    })),
    sensitivity: sensitivityRows.map((row) => ({
      scenario: stringField(row, "scenario"),
      month: numberField(row, "month"),
      city: stringField(row, "city"),
      historicalEbikeShare: numberField(row, "historical_ebike_share"),
      ebikeShareScenario: numberField(row, "ebike_share_scenario"),
      imbalanceBikes: numberField(row, "imbalance_bikes"),
      requiredCrews: numberField(row, "required_crews"),
    })),
  }));

  return dataPromise;
}

export async function getOperationsOverview() {
  const { staffing, backtest } = await getOperationsData();
  const cities = new Set(staffing.map((row) => row.city));
  const crewsByMonth = new Map<number, number>();

  for (const row of staffing) {
    crewsByMonth.set(
      row.month,
      (crewsByMonth.get(row.month) ?? 0) + row.totalCrewsNeeded,
    );
  }

  const peak = [...crewsByMonth.entries()].sort((a, b) => b[1] - a[1])[0];
  const tripActualTotal = backtest.reduce(
    (sum, row) => sum + row.actualTripStarts,
    0,
  );
  const tripAbsoluteError = backtest.reduce(
    (sum, row) => sum + Math.abs(row.forecastTripStarts - row.actualTripStarts),
    0,
  );
  const imbalanceActualTotal = backtest.reduce(
    (sum, row) => sum + row.actualRebalanceProxyBikes,
    0,
  );
  const imbalanceAbsoluteError = backtest.reduce(
    (sum, row) =>
      sum +
      Math.abs(
        row.forecastRebalanceProxyBikes - row.actualRebalanceProxyBikes,
      ),
    0,
  );

  return {
    cityCount: cities.size,
    totalCrewMonths: staffing.reduce(
      (sum, row) => sum + row.totalCrewsNeeded,
      0,
    ),
    seasonalCrewMonths: staffing.reduce(
      (sum, row) => sum + row.seasonalCrews,
      0,
    ),
    peakCrewCount: peak?.[1] ?? 0,
    peakMonth: staffing.find((row) => row.month === peak?.[0])?.monthName ?? "",
    tripWapePct:
      tripActualTotal > 0
        ? Number(((tripAbsoluteError / tripActualTotal) * 100).toFixed(1))
        : 0,
    imbalanceWapePct:
      imbalanceActualTotal > 0
        ? Number(((imbalanceAbsoluteError / imbalanceActualTotal) * 100).toFixed(1))
        : 0,
    actualThrough: "September 2026",
    forecastTripStarts: staffing.reduce(
      (sum, row) => sum + row.forecastTripStarts,
      0,
    ),
    dataQualityNote:
      "Forecasts are city-month estimates. The station-week positive-net-inflow measure is a rebalancing proxy, not a count of observed van moves. Station-name matching omitted 1.87% of start endpoints and 1.98% of end endpoints from city assignment.",
    modelAssumptions: [
      "Trip demand uses the average for the same calendar month in 2024 and 2025.",
      "The rebalance proxy sums positive station net inflow by city-week and scales it to a month.",
      "One crew is provisionally modeled at 32 bike moves per workday across 22 workdays (704 moves/month).",
      "Full-time staffing is the annual minimum for each city; seasonal crews cover the monthly peak.",
      "Seasonal hiring lead time is two months. Event uplift is zero until event effects are calibrated.",
      "Wages, hiring costs, and lost-trip revenue were not supplied, so no dollar cost or revenue estimate is claimed.",
    ],
  };
}

export function filterStaffing(
  rows: StaffingRow[],
  city?: string,
  month?: number,
): StaffingRow[] {
  return rows.filter(
    (row) =>
      (!city || row.city.toLowerCase() === city.toLowerCase()) &&
      (month === undefined || row.month === month),
  );
}

export function filterBacktest(
  rows: BacktestRow[],
  city?: string,
  month?: number,
): BacktestRow[] {
  return rows.filter(
    (row) =>
      (!city || row.city.toLowerCase() === city.toLowerCase()) &&
      (month === undefined || row.month === month),
  );
}

export function filterSensitivity(
  rows: SensitivityRow[],
  city?: string,
  month?: number,
): SensitivityRow[] {
  return rows.filter(
    (row) =>
      (!city || row.city.toLowerCase() === city.toLowerCase()) &&
      (month === undefined || row.month === month),
  );
}
