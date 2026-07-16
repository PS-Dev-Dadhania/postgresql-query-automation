"""Flask web server serving the Premium SQL Workspace Client interface and API."""

import datetime
import logging
import os
import sys
import time
import webbrowser
from decimal import Decimal
from threading import Timer
from flask import Flask, jsonify, request

import config
import db
import excel_export
import queries

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler("execution.log", mode="w", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("workspace_server")

app = Flask(__name__, static_folder="static", static_url_path="")

# In-memory session caches
saved_drafts = {}
execution_records = {}
active_connection_params = {
    "host": config.DB_HOST,
    "port": str(config.DB_PORT),
    "database": config.DB_NAME,
    "user": config.DB_USER,
    "password": config.DB_PASSWORD or ""
}


def serialize_db_value(val):
    """Converts non-JSON serializable database types (Decimal, dates) to standard types."""
    if isinstance(val, Decimal):
        return float(val)
    elif isinstance(val, (datetime.datetime, datetime.date)):
        return val.strftime("%Y-%m-%d")
    elif val is None:
        return None
    return val


@app.route("/")
def index():
    """Serves the main workspace application page."""
    return app.send_static_file("index.html")


@app.route("/api/queries", methods=["GET"])
def get_queries():
    """Returns the list of 15 queries, descriptions, saved drafts, and connection status."""
    # Check if we can connect to DB with default configuration credentials
    db_connected = False
    try:
        success, _ = db.test_db_connection(active_connection_params)
        db_connected = success
    except Exception:
        pass

    payload = {
        "db_config": {
            "host": active_connection_params["host"],
            "port": active_connection_params["port"],
            "database": active_connection_params["database"],
            "user": active_connection_params["user"],
            "connected": db_connected
        },
        "queries": {}
    }

    for q_id, q_def in queries.QUERIES.items():
        payload["queries"][q_id] = {
            "question_title": q_def["question_title"],
            "description": q_def["description"],
            "solution_sql": ";\n".join(q_def["sql"]).strip(),
            "savedSql": saved_drafts.get(q_id, ""),
            "status": execution_records.get(q_id, {}).get("status", "pending"),
            "rowsCount": execution_records.get(q_id, {}).get("rowsCount", 0),
            "duration": execution_records.get(q_id, {}).get("duration", 0),
            "lastExecuted": execution_records.get(q_id, {}).get("lastExecuted", None),
            "errorMessage": execution_records.get(q_id, {}).get("errorMessage", "")
        }

    return jsonify(payload)


@app.route("/api/schema", methods=["GET"])
def get_schema():
    """Returns public tables and their columns with data types from the connected database."""
    try:
        with db.get_db_connection(active_connection_params) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT table_name, column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    ORDER BY table_name, ordinal_position;
                """)
                rows = cur.fetchall()
                
                schema = {}
                for row in rows:
                    t_name, c_name, d_type = row
                    if t_name not in schema:
                        schema[t_name] = []
                    schema[t_name].append({
                        "name": c_name,
                        "type": d_type
                    })
                return jsonify({"status": "success", "schema": schema})
    except Exception as e:
        logger.warning(f"Failed to fetch database schema: {e}")
        return jsonify({"status": "failed", "message": str(e)}), 400


@app.route("/api/connect", methods=["POST"])
def connect_database():
    """Tests connection or updates active database connection parameters."""
    data = request.json or {}
    test_only = data.get("test_only", True)

    params = {
        "host": data.get("host", "localhost"),
        "port": data.get("port", "5432"),
        "database": data.get("database", "dvdrental"),
        "user": data.get("user", "postgres"),
        "password": data.get("password", "")
    }

    success, message = db.test_db_connection(params)

    if success:
        if not test_only:
            global active_connection_params
            active_connection_params = params
            logger.info(f"Database connected successfully to {params['database']}@{params['host']}.")
        return jsonify({"status": "success", "message": "Connection tested successfully."})
    else:
        logger.warning(f"Database connection attempt failed: {message}")
        return jsonify({"status": "failed", "message": message}), 400


@app.route("/api/execute", methods=["POST"])
def execute_sql():
    """Executes manual SQL queries inside a single isolated transaction block."""
    data = request.json or {}
    q_id = data.get("q_id")
    sql_text = data.get("sql", "")
    conn_params = data.get("connection", active_connection_params)

    if not q_id:
        return jsonify({"status": "failed", "message": "Question index 'q_id' is required."}), 400

    # Save SQL text as draft automatically on execution
    saved_drafts[q_id] = sql_text

    # Parse and split queries by semicolon
    statements = [stmt.strip() for stmt in sql_text.split(";") if stmt.strip()]
    if not statements:
        return jsonify({"status": "failed", "message": "Query code cannot be empty."}), 400

    start_time = time.time()
    try:
        with db.get_db_connection(conn_params) as conn:
            with conn.cursor() as cur:
                headers = []
                rows = []

                # Execute statements sequentially
                for idx, stmt in enumerate(statements):
                    cur.execute(stmt)

                    # Fetch rows from the final select statement in execution list
                    if idx == len(statements) - 1:
                        if cur.description:
                            headers = [desc[0] for desc in cur.description]
                            rows = cur.fetchall()

                # Serialize records safely for JSON
                serialized_rows = [[serialize_db_value(item) for item in row] for row in rows]
                conn.commit()

                duration_ms = (time.time() - start_time) * 1000

                # Cache execution state
                execution_records[q_id] = {
                    "status": "completed",
                    "rowsCount": len(serialized_rows),
                    "duration": duration_ms,
                    "lastExecuted": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "errorMessage": ""
                }

                return jsonify({
                    "status": "success",
                    "headers": headers,
                    "rows": serialized_rows,
                    "count": len(serialized_rows),
                    "duration": duration_ms
                })

    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        err_msg = str(e)
        logger.error(f"Error executing query {q_id}: {err_msg}")

        # Cache failed execution status
        execution_records[q_id] = {
            "status": "failed",
            "rowsCount": 0,
            "duration": duration_ms,
            "lastExecuted": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "errorMessage": err_msg
        }

        return jsonify({
            "status": "failed",
            "message": err_msg,
            "duration": duration_ms
        }), 400


@app.route("/api/save", methods=["POST"])
def save_draft():
    """Saves user's query draft in memory."""
    data = request.json or {}
    q_id = data.get("q_id")
    sql_text = data.get("sql", "")

    if not q_id:
        return jsonify({"status": "failed", "message": "Question index 'q_id' is required."}), 400

    saved_drafts[q_id] = sql_text
    return jsonify({"status": "success", "message": "Draft saved."})


@app.route("/api/export", methods=["POST"])
def export_results():
    """Compiles results from all executed exercises into the styled Excel workbook."""
    data = request.json or {}
    sheets_payload = data.get("sheets", [])

    if not sheets_payload:
        return jsonify({"status": "failed", "message": "No executed query data supplied for export."}), 400

    try:
        wb = excel_export.create_styled_workbook()

        for sheet in sheets_payload:
            q_id = sheet.get("q_id")
            status = sheet.get("status", "completed")
            title = sheet.get("title", "")
            description = sheet.get("description", "")
            sql_query = sheet.get("sql_query", "")
            headers = sheet.get("headers", [])
            rows_data = sheet.get("rows", [])
            error_message = sheet.get("errorMessage", "")
            duration = float(sheet.get("duration", 0))
            timestamp = sheet.get("timestamp", "")
            database = sheet.get("database", "dvdrental")

            # Convert JSON numbers/dates back to proper structures for Excel cell formatting
            formatted_rows = []
            for row in rows_data:
                cleaned_row = []
                for val in row:
                    cleaned_row.append(val)
                formatted_rows.append(tuple(cleaned_row))

            excel_export.export_query_results_to_sheet(
                wb=wb,
                sheet_name=q_id,
                status=status,
                title=title,
                description=description,
                sql_query=sql_query,
                headers=headers,
                rows=formatted_rows,
                error_message=error_message,
                duration_ms=duration,
                timestamp=timestamp,
                database=database
            )

        excel_export.save_workbook(wb, config.OUTPUT_FILE)
        logger.info(f"Excel workbook generated successfully at: {config.OUTPUT_FILE}")

        return jsonify({
            "status": "success",
            "path": str(config.OUTPUT_FILE.relative_to(config.OUTPUT_DIR.parent) if config.OUTPUT_FILE.is_relative_to(config.OUTPUT_DIR.parent) else config.OUTPUT_FILE)
        })

    except Exception as e:
        logger.error(f"Excel generation failed: {e}", exc_info=True)
        return jsonify({"status": "failed", "message": str(e)}), 500


def open_browser():
    """Opens a new browser tab pointing to the local Flask application."""
    logger.info("Launching user interface in browser...")
    webbrowser.open_new("http://127.0.0.1:5000/")


def main():
    """Runs the Flask local web application and opens the client interface."""
    logger.info("Initializing Premium SQL Automation Client...")
    
    # Run config validation
    try:
        config.validate_config()
    except ValueError as e:
        logger.warning(f"Initial config validation warning: {e}. Client connection pane will default to localhost.")

    # Start browser tab deferred thread
    Timer(1.2, open_browser).start()

    # Launch server
    app.run(host="127.0.0.1", port=5000, debug=False)


if __name__ == "__main__":
    main()
