# BlueBikes Operations Assistant

A Streamlit dashboard and Python LangChain/LangGraph agent for BlueBikes
rebalancing crew planning in Boston and nearby municipalities.

## Run the Streamlit app

Use Python 3.13+ and [uv](https://docs.astral.sh/uv/). From the repository root:

```bash
uv sync --locked
uv run streamlit run artifacts/bluebikes-ops/app.py
```

Open the URL Streamlit prints. The dashboard, staffing plan, backtest and
sensitivity tables work without an API key. LangChain and LangGraph are loaded
only when a chat or event-extraction request is submitted, not during dashboard
startup.

In Replit, use the existing `artifacts/bluebikes-ops: web` workflow. It binds to
the managed `PORT` and serves the root preview.

## Configure AI access

The app reads credentials from its runtime environment, not from source files:

- In Replit, the existing OpenAI integration supplies
  `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL`.
- Outside Replit, configure `OPENAI_API_KEY` securely in your host or local
  process environment. Set `OPENAI_MODEL` to a Responses API/tool-calling model
  supported by your account. The default model is the existing Replit model
  `gpt-5.6-terra`.

Never commit API keys, `.env` files or Streamlit `secrets.toml`. The application
does not automatically load `.env` files.

## Main files

| Location | Purpose |
| --- | --- |
| `artifacts/bluebikes-ops/app.py` | Streamlit interface |
| `artifacts/bluebikes-ops/operations_agent.py` | Python LangChain tools, OpenAI client and LangGraph tool loop |
| `artifacts/bluebikes-ops/operations_data.py` | Planning data access and summaries |
| `artifacts/api-server/data/` | Compact staffing, backtest and sensitivity CSVs used by the app |
| `notebooks/BlueBikes_2026_Operations_Forecast.ipynb` | Forecast analysis and notebook-based Python agent logic |
| `tests/test_streamlit_app.py` | Offline rendering and startup regression checks |

The earlier React frontend and TypeScript API remain in the repository for
reference; they are not required to run the Streamlit interface locally.

## Data and notebook

The app uses the committed compact forecast tables. It does not require the
multi-gigabyte raw trip files for dashboard viewing or assistant lookups.

To recompute the forecast, open the notebook and follow its input-path setup
before running the analysis cells. Supply the original 2024–2025 training CSVs,
January–September 2026 backtest CSVs, and station reference list. Raw uploads and
downloadable ZIPs are excluded from Git; retain those separately.

The notebook's agent setup cell contains its own model configuration. When
running it outside Replit, choose a model available to your OpenAI account there
as well. Do not paste keys into notebook cells or outputs.

## Offline checks

```bash
uv run python -m unittest discover -s tests -v
```

These checks do not call OpenAI or modify planning data.

## Modeling limits

- Same-calendar-month averages from 2024 and 2025 provide the baseline forecast.
- Rebalancing pressure is a station-net-flow proxy, not observed van moves.
- Capacity is provisionally 704 bike-move units per crew-month.
- Full-time staffing covers the monthly minimum; seasonal crews cover peaks.
- January–September 2026 actuals are used for backtesting, not baseline training.
- Event extraction structures supplied text; event demand effects still require
  calibration. Wages, hiring costs and lost-trip revenue have not been supplied.

Review these assumptions before treating the plan as an operational commitment.
