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

The assistant uses your own `OPENAI_API_KEY` and calls OpenAI directly at
`https://api.openai.com/v1`. It does not use the Replit AI proxy or its credentials.

- In Replit, save `OPENAI_API_KEY` in project Secrets.
- In Streamlit Community Cloud, add it in the app's Secrets settings using a
  top-level TOML string. Streamlit exposes top-level string secrets as environment
  variables. Secrets do not transfer from Replit or GitHub automatically.
- For other hosts, configure it securely in the process environment.

For Streamlit Cloud, use this format with your actual key in the **Secrets
settings only**, never in a committed file:

```toml
OPENAI_API_KEY = "your-openai-api-key"
OPENAI_MODEL = "gpt-5.4"
```

`OPENAI_MODEL` is optional and defaults to `gpt-5.4`. Choose a Responses
API/tool-calling model supported by your account. Requests are billed to your
OpenAI account. If the key is missing, the assistant reports a configuration
error instead of falling back to Replit.

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

The notebook also reads `OPENAI_API_KEY` and optional `OPENAI_MODEL` from its
runtime environment, with no Replit fallback. Do not paste keys into notebook
cells or outputs.

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
