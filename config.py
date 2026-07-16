"""Configuration module to load and validate database settings from a .env file."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from the current directory
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

# Database Configurations
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "dvdrental")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD")

# Output directory and Excel filename
OUTPUT_DIR = Path(__file__).resolve().parent / "output"
OUTPUT_FILE = OUTPUT_DIR / "sql_exercise_outputs.xlsx"


def validate_config() -> None:
    """Validates that critical configuration values are present.

    Raises:
        ValueError: If any required database credential is missing.
    """
    missing_vars = []
    if not DB_PASSWORD:
        missing_vars.append("DB_PASSWORD")
    if not DB_USER:
        missing_vars.append("DB_USER")
    if not DB_NAME:
        missing_vars.append("DB_NAME")

    if missing_vars:
        raise ValueError(
            f"Missing required database configurations in .env: {', '.join(missing_vars)}. "
            "Please copy .env.example to .env and fill in the values."
        )
