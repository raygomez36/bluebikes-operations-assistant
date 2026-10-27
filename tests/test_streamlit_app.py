"""Offline regression checks for the Streamlit dashboard."""

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

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

    def test_model_requires_personal_key(self):
        sys.path.insert(0, str(APP.parent))
        import operations_agent

        with patch.dict(
            os.environ,
            {"AI_INTEGRATIONS_OPENAI_API_KEY": "unused-test-proxy-key"},
            clear=True,
        ):
            with self.assertRaisesRegex(RuntimeError, "OPENAI_API_KEY"):
                operations_agent._get_model()

    def test_model_uses_direct_openai(self):
        import operations_agent

        with patch.dict(
            os.environ,
            {
                "OPENAI_API_KEY": "test-personal-key",
                "AI_INTEGRATIONS_OPENAI_API_KEY": "unused-test-proxy-key",
                "AI_INTEGRATIONS_OPENAI_BASE_URL": "https://invalid.example/proxy",
            },
            clear=True,
        ), patch.object(operations_agent, "ChatOpenAI") as model:
            operations_agent._get_model()
            options = model.call_args.kwargs
            self.assertEqual(options["api_key"], "test-personal-key")
            self.assertEqual(options["base_url"], "https://api.openai.com/v1")
            self.assertEqual(options["model"], "gpt-5.4")
            self.assertTrue(options["use_responses_api"])

    def test_provider_errors_do_not_expose_exception_details(self):
        from assistant_errors import assistant_error_message

        for status in (401, 403, 429, 500):
            with self.subTest(status=status):
                error_type = type("ProviderError", (Exception,), {"status_code": status})
                text = assistant_error_message(error_type("private-provider-details"))
                self.assertNotIn("private-provider-details", text)
                self.assertTrue(text)


if __name__ == "__main__":
    unittest.main()
