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
def get_db_connection(conn_params: dict = None) -> Generator[PgConnection, None, None]:
    """Context manager to obtain and safely close a PostgreSQL database connection.

    Args:
        conn_params: Optional dict containing host, port, database, user, password.

    Yields:
        PgConnection: Active connection to the database.

    Raises:
        psycopg2.Error: If connection to database fails.
    """
    conn = None
    
    # Use provided params or fallback to config
    host = conn_params.get("host", config.DB_HOST) if conn_params else config.DB_HOST
    port = conn_params.get("port", config.DB_PORT) if conn_params else config.DB_PORT
    database = conn_params.get("database", config.DB_NAME) if conn_params else config.DB_NAME
    user = conn_params.get("user", config.DB_USER) if conn_params else config.DB_USER
    password = conn_params.get("password", config.DB_PASSWORD) if conn_params else config.DB_PASSWORD

    try:
        logger.debug(
            f"Attempting to connect to PostgreSQL: Host={host}, "
            f"Port={port}, DB={database}, User={user}"
        )
        conn = psycopg2.connect(
            host=host,
            port=port,
            database=database,
            user=user,
            password=password,
        )
        logger.info(f"Successfully connected to database '{database}'.")
        yield conn
    except psycopg2.Error as e:
        logger.error(
            f"Database connection error for database '{database}': {e}",
            exc_info=True,
        )
        raise
    finally:
        if conn is not None and not conn.closed:
            conn.close()
            logger.info("Database connection closed.")


def test_db_connection(conn_params: dict) -> tuple[bool, str]:
    """Tests connection to PostgreSQL with provided parameters.

    Args:
        conn_params: Dict containing host, port, database, user, password.

    Returns:
        tuple[bool, str]: (Success status, detail message)
    """
    try:
        host = conn_params.get("host", "localhost")
        port = int(conn_params.get("port", 5432))
        database = conn_params.get("database", "dvdrental")
        user = conn_params.get("user", "postgres")
        password = conn_params.get("password", "")

        conn = psycopg2.connect(
            host=host,
            port=port,
            database=database,
            user=user,
            password=password,
            connect_timeout=3
        )
        conn.close()
        return True, "Connection successful."
    except Exception as e:
        return False, str(e)

