"""Offline regression checks for the Streamlit dashboard."""

import sys
import unittest
from pathlib import Path

from streamlit.testing.v1 import AppTest


APP = Path(__file__).resolve().parents[1] / "artifacts/bluebikes-ops/app.py"


class StreamlitAppTests(unittest.TestCase):
    def test_dashboard_pages_do_not_require_agent_imports(self):
        app = AppTest.from_file(str(APP)).run(timeout=20)
        self.assertEqual(len(app.exception), 0)
        self.assertIn(
            "BlueBikes Operations Assistant", [title.value for title in app.title]
        )
        self.assertEqual(len(app.metric), 6)
        for section in ("Staffing plan", "Backtest", "Sensitivity", "Assistant"):
            with self.subTest(section=section):
                app.sidebar.radio[0].set_value(section).run(timeout=20)
                self.assertEqual(len(app.exception), 0)
        self.assertNotIn(
            "operations_agent",
            sys.modules,
            "Opening dashboards or chat must not import the AI stack eagerly",
        )


if __name__ == "__main__":
    unittest.main()
