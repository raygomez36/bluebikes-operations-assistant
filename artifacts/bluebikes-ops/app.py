"""Streamlit interface for the Bluebikes 2026 operations planning assistant."""

from __future__ import annotations

import os

import pandas as pd
import streamlit as st

from assistant_errors import assistant_error_message
from operations_data import city_names, filter_rows, get_overview, load_operations_data


st.set_page_config(
    page_title="BlueBikes Operations Assistant",
    page_icon="🚲",
    layout="wide",
)

try:
    staffing, backtest, sensitivity = load_operations_data()
    overview = get_overview()
    cities = city_names()
except (FileNotFoundError, KeyError, ValueError) as exc:
    st.error(f"Could not load the planning data: {exc}")
    st.stop()

st.sidebar.title("BlueBikes")
st.sidebar.caption("OPERATIONS DESK · 2026")
city_choice = st.sidebar.selectbox("Planning area", ["All cities", *cities])
selected_city = None if city_choice == "All cities" else city_choice
section = st.sidebar.radio(
    "Workspace",
    ["Overview", "Staffing plan", "Backtest", "Sensitivity", "Assistant"],
)
st.sidebar.divider()
st.sidebar.caption(f"Trip backtest actuals through {overview['actual_through']}")

st.title("BlueBikes Operations Assistant")
st.caption(
    "Monthly demand, rebalance pressure, and crew planning for Boston and nearby cities."
)


def visible_rows(frame: pd.DataFrame) -> pd.DataFrame:
    return filter_rows(frame, city=selected_city).sort_values(
        ["month", "city"], kind="stable"
    )


def display_plan(frame: pd.DataFrame) -> None:
    columns = [
        "month_name",
        "city",
        "forecast_trip_starts",
        "forecast_rebalance_proxy_bikes",
        "total_crews_needed",
        "full_time_crews",
        "seasonal_crews",
        "seasonal_hires",
        "seasonal_releases",
        "hire_by",
        "contract_note",
    ]
    labels = {
        "month_name": "Month",
        "city": "City",
        "forecast_trip_starts": "Forecast trips",
        "forecast_rebalance_proxy_bikes": "Rebalance proxy",
        "total_crews_needed": "Crews",
        "full_time_crews": "Full-time",
        "seasonal_crews": "Seasonal",
        "seasonal_hires": "Seasonal hires",
        "seasonal_releases": "Seasonal releases",
        "hire_by": "Hire by",
        "contract_note": "Contract note",
    }
    st.dataframe(
        frame[columns].rename(columns=labels),
        use_container_width=True,
        hide_index=True,
    )


def render_overview() -> None:
    st.subheader("2026 planning overview")
    cols = st.columns(6)
    metrics = [
        ("Cities", overview["city_count"], "Active service areas"),
        ("Crew-months", f"{overview['total_crew_months']:,}", "Total plan"),
        ("Seasonal crew-months", f"{overview['seasonal_crew_months']:,}", "Flexible capacity"),
        ("Peak monthly crews", f"{overview['peak_crew_count']:,}", overview["peak_month"]),
        ("Trip WAPE", f"{overview['trip_wape_pct']:.1f}%", "Jan–Sep backtest"),
        ("Imbalance WAPE", f"{overview['imbalance_wape_pct']:.1f}%", "Rebalance proxy"),
    ]
    for col, (label, value, help_text) in zip(cols, metrics):
        col.metric(label, value, help=help_text)

    rows = visible_rows(staffing)
    chart = (
        rows.groupby(["month", "month_name"], as_index=False)
        .agg(
            total_crews=("total_crews_needed", "sum"),
            seasonal_crews=("seasonal_crews", "sum"),
            forecast_trips=("forecast_trip_starts", "sum"),
        )
        .sort_values("month")
        .set_index("month_name")
    )
    left, right = st.columns([1.6, 1])
    with left:
        st.markdown("#### Monthly crews")
        st.bar_chart(chart[["total_crews", "seasonal_crews"]])
        st.caption(
            f"Forecast trip starts for this selection: "
            f"{int(chart['forecast_trips'].sum()):,}"
        )
    with right:
        st.markdown("#### Data quality")
        st.info(overview["data_quality_note"])
        st.markdown("#### Key assumptions")
        for assumption in overview["assumptions"]:
            st.markdown(f"- {assumption}")


def render_staffing() -> None:
    st.subheader("Monthly staffing plan")
    st.caption("Full-time baseline, seasonal coverage, hiring, and release timing.")
    rows = visible_rows(staffing)
    selected_month = st.selectbox(
        "Month",
        ["All months", *staffing.sort_values("month")["month_name"].drop_duplicates().tolist()],
    )
    if selected_month != "All months":
        rows = rows[rows["month_name"] == selected_month]
    display_plan(rows)
    if not rows.empty:
        chart = rows.pivot_table(
            index="month_name",
            columns="city",
            values="total_crews_needed",
            aggfunc="sum",
        )
        st.markdown("#### Crew counts by month")
        st.line_chart(chart)


def render_backtest() -> None:
    st.subheader("2026 forecast backtest")
    st.caption(
        "January–September actuals compared with the 2024–2025 seasonal forecast. "
        "A proxy capacity gap is not an observed service failure."
    )
    rows = visible_rows(backtest)
    if rows.empty:
        st.info("No backtest records match this city.")
        return
    actual_total = int(rows["actual_trip_starts"].sum())
    forecast_total = int(rows["forecast_trip_starts"].sum())
    crew_gap = int(rows["crew_shortfall_proxy"].sum())
    a, b, c = st.columns(3)
    a.metric("Forecast trips", f"{forecast_total:,}")
    b.metric("Actual trips", f"{actual_total:,}", f"{actual_total - forecast_total:+,} vs forecast")
    c.metric("Implied crew-gap months", f"{crew_gap:,}")

    trip_chart = rows.pivot_table(
        index="month", values=["forecast_trip_starts", "actual_trip_starts"], aggfunc="sum"
    ).sort_index()
    st.markdown("#### Forecast vs. actual trips")
    st.line_chart(trip_chart)

    display_columns = [
        "month",
        "city",
        "forecast_trip_starts",
        "actual_trip_starts",
        "trip_forecast_error_pct",
        "imbalance_forecast_error_pct",
        "planned_crews",
        "crews_implied_by_actual_proxy",
        "crew_shortfall_proxy",
        "capacity_shortfall_proxy_bikes",
    ]
    labels = {
        "month": "Month",
        "city": "City",
        "forecast_trip_starts": "Forecast trips",
        "actual_trip_starts": "Actual trips",
        "trip_forecast_error_pct": "Trip error %",
        "imbalance_forecast_error_pct": "Proxy error %",
        "planned_crews": "Planned crews",
        "crews_implied_by_actual_proxy": "Implied crews",
        "crew_shortfall_proxy": "Crew gap",
        "capacity_shortfall_proxy_bikes": "Capacity gap proxy",
    }
    st.dataframe(
        rows[display_columns].rename(columns=labels),
        use_container_width=True,
        hide_index=True,
    )


def render_sensitivity() -> None:
    st.subheader("Ridership and e-bike sensitivity")
    st.caption(
        "Scenario outputs are planning assumptions, not a calibrated causal estimate."
    )
    scenarios = sensitivity["scenario"].drop_duplicates().tolist()
    chosen_scenario = st.selectbox("Scenario", scenarios)
    rows = visible_rows(sensitivity)
    rows = rows[rows["scenario"] == chosen_scenario]
    if rows.empty:
        st.info("No scenario rows match this selection.")
        return

    scenario_total = int(rows["required_crews"].sum())
    proxy_total = int(rows["imbalance_bikes"].sum())
    a, b = st.columns(2)
    a.metric("Crew-months in selected scenario", f"{scenario_total:,}")
    b.metric("Modeled rebalance proxy", f"{proxy_total:,}")
    chart = rows.pivot_table(
        index="month",
        columns="city",
        values="required_crews",
        aggfunc="sum",
    ).sort_index()
    st.line_chart(chart)
    labels = {
        "scenario": "Scenario",
        "month": "Month",
        "city": "City",
        "historical_ebike_share": "Historical e-bike share",
        "ebike_share_scenario": "Scenario e-bike share",
        "imbalance_bikes": "Imbalance proxy",
        "required_crews": "Required crews",
    }
    st.dataframe(
        rows.rename(columns=labels),
        use_container_width=True,
        hide_index=True,
    )


def render_assistant() -> None:
    st.subheader("Ask the operations assistant")
    st.caption(
        "The Python LangGraph agent can query staffing, backtest, and sensitivity "
        "data, simulate crew changes, and extract event facts."
    )
    if not os.environ.get("OPENAI_API_KEY"):
        st.warning(
            "Add OPENAI_API_KEY through runtime secrets to enable chat. "
            "Do not paste keys into the app or notebook."
        )

    if "operations_chat" not in st.session_state:
        st.session_state.operations_chat = []

    for turn in st.session_state.operations_chat:
        with st.chat_message(turn["role"]):
            st.markdown(turn["content"])
            if turn.get("tools_used"):
                st.caption("Tools used: " + ", ".join(turn["tools_used"]))
            for block in turn.get("data_blocks", []):
                with st.expander(block["title"]):
                    st.code(block["json"], language="json")

    question = st.chat_input("Ask about staffing, backtest, or a crew scenario")
    if question:
        history = list(st.session_state.operations_chat)
        st.session_state.operations_chat.append(
            {"role": "user", "content": question}
        )
        try:
            with st.spinner("Checking the planning data…"):
                # Keep LangChain/LangGraph off the dashboard's startup path.
                from operations_agent import ask_operations_agent

                response = ask_operations_agent(question, history)
            st.session_state.operations_chat.append(
                {
                    "role": "assistant",
                    "content": str(response["answer"]),
                    "tools_used": response["tools_used"],
                    "data_blocks": response["data_blocks"],
                }
            )
        except Exception as exc:
            st.session_state.operations_chat.append(
                {
                    "role": "assistant",
                    "content": assistant_error_message(exc),
                }
            )
        st.rerun()

    st.divider()
    st.markdown("#### Event text intake")
    st.caption(
        "Paste source text from an event page or calendar. The model extracts "
        "explicit facts only; verify them before operational use."
    )
    with st.form("event-extraction"):
        source_text = st.text_area(
            "Event source text",
            placeholder="Paste an event announcement, schedule, or official page excerpt…",
            height=140,
        )
        submitted = st.form_submit_button("Extract event details")
    if submitted:
        if len(source_text.strip()) < 10:
            st.warning("Enter at least 10 characters of source text.")
        else:
            try:
                with st.spinner("Extracting event details…"):
                    from operations_agent import extract_structured_events

                    events = extract_structured_events(source_text.strip())
                if events:
                    st.dataframe(pd.DataFrame(events), use_container_width=True, hide_index=True)
                else:
                    st.info("No event records were stated in that text.")
            except Exception as exc:
                st.error(assistant_error_message(exc))


if section == "Overview":
    render_overview()
elif section == "Staffing plan":
    render_staffing()
elif section == "Backtest":
    render_backtest()
elif section == "Sensitivity":
    render_sensitivity()
else:
    render_assistant()

st.divider()
st.caption(
    "Planning proxy only: one crew is provisionally modeled at 704 bike-move "
    "units/month. This is not observed van throughput or a validated service-level forecast."
)
