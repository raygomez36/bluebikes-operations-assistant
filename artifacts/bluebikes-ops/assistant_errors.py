"""Safe, actionable messages without exposing provider exception contents."""


def assistant_error_message(error: Exception) -> str:
    status = getattr(error, "status_code", None)
    if status == 401:
        return (
            "OpenAI rejected the configured API key. Replace OPENAI_API_KEY in "
            "runtime Secrets, then restart the app."
        )
    if status == 403:
        return (
            "OpenAI denied this request. Check the API key's permissions and "
            "whether your account can use the configured OPENAI_MODEL."
        )
    if status == 429:
        return (
            "OpenAI's rate or usage limit was reached. Check your OpenAI "
            "account's limits and billing, then try again."
        )
    return (
        "The assistant could not complete this request. Check OPENAI_API_KEY "
        "and OPENAI_MODEL in runtime Secrets and try again."
    )
