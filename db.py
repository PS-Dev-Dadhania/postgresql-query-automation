"""Database connection management module for PostgreSQL."""

import logging
from contextlib import contextmanager
from typing import Generator
import psycopg2
from psycopg2.extensions import connection as PgConnection

import config

# Set up logging for this module
logger = logging.getLogger(__name__)


@contextmanager
def get_db_connection() -> Generator[PgConnection, None, None]:
    """Context manager to obtain and safely close a PostgreSQL database connection.

    Yields:
        PgConnection: Active connection to the database.

    Raises:
        psycopg2.Error: If connection to database fails.
    """
    conn = None
    try:
        logger.debug(
            f"Attempting to connect to PostgreSQL: Host={config.DB_HOST}, "
            f"Port={config.DB_PORT}, DB={config.DB_NAME}, User={config.DB_USER}"
        )
        conn = psycopg2.connect(
            host=config.DB_HOST,
            port=config.DB_PORT,
            database=config.DB_NAME,
            user=config.DB_USER,
            password=config.DB_PASSWORD,
        )
        logger.info(f"Successfully connected to database '{config.DB_NAME}'.")
        yield conn
    except psycopg2.Error as e:
        logger.error(
            f"Database connection error for database '{config.DB_NAME}': {e}",
            exc_info=True,
        )
        raise
    finally:
        if conn is not None and not conn.closed:
            conn.close()
            logger.info("Database connection closed.")
