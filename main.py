"""Main orchestration module to run queries and export them to Excel."""

import logging
import sys
import time
import traceback
from pathlib import Path
from tqdm import tqdm

import config
import db
import excel_export
import queries

# Set up logging to stdout and file
def setup_logging() -> None:
    """Configures application logging to output to both console and a log file."""
    log_format = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    
    # We will log INFO and higher to console and debug info to file
    logging.basicConfig(
        level=logging.INFO,
        format=log_format,
        handlers=[
            logging.FileHandler("execution.log", mode="w", encoding="utf-8"),
            logging.StreamHandler(sys.stdout),
        ],
    )


def main() -> None:
    """Main orchestrator function that runs SQL queries and generates Excel sheets."""
    setup_logging()
    logger = logging.getLogger("orchestrator")
    logger.info("Starting SQL Automation Project...")

    # 1. Validate configurations
    try:
        config.validate_config()
    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        sys.exit(1)

    start_time = time.time()
    successful_count = 0
    failed_count = 0
    total_queries = len(queries.QUERIES)

    wb = excel_export.create_styled_workbook()

    # 2. Connect to database and execute queries
    try:
        with db.get_db_connection() as conn:
            with conn.cursor() as cur:
                # Iterate over queries with a tqdm progress bar
                pbar = tqdm(
                    queries.QUERIES.items(),
                    desc="Executing SQL Exercises",
                    unit="query",
                )
                for q_id, q_def in pbar:
                    pbar.set_postfix_str(q_def["question_title"][:20])
                    logger.info(
                        f"Running {q_id}: {q_def['question_title']}..."
                    )

                    try:
                        headers = []
                        rows = []

                        # Execute DDL/DML statements sequentially
                        for stmt_idx, stmt in enumerate(q_def["sql"]):
                            cur.execute(stmt)

                            # Fetch results only from the final statement (SELECT)
                            if stmt_idx == len(q_def["sql"]) - 1:
                                if cur.description:
                                    headers = [
                                        desc[0] for desc in cur.description
                                    ]
                                    rows = cur.fetchall()

                        # Write results to the worksheet
                        if headers:
                            excel_export.export_query_results_to_sheet(
                                wb, q_id, headers, rows
                            )
                            successful_count += 1
                            logger.info(f"{q_id} completed successfully.")
                        else:
                            # Safeguard if a select query returns no metadata description
                            logger.warning(
                                f"{q_id} did not yield a result set."
                            )
                            excel_export.export_query_results_to_sheet(
                                wb,
                                q_id,
                                ["Status"],
                                [("Query executed but returned no headers.",)],
                            )
                            successful_count += 1

                        # Commit each query transaction block individually
                        conn.commit()

                    except Exception as q_err:
                        failed_count += 1
                        logger.error(
                            f"Error executing {q_id} ('{q_def['question_title']}'): {q_err}"
                        )
                        # Log full stack trace to the log file (handled by basicConfig FileHandler)
                        logger.debug(traceback.format_exc())

                        # Roll back current transaction block to allow subsequent queries to run
                        try:
                            conn.rollback()
                        except Exception as rb_err:
                            logger.error(
                                f"Failed to rollback transaction: {rb_err}"
                            )

                        # Write error details into Excel sheet for that question
                        error_headers = ["Error Status", "Message"]
                        error_rows = [
                            (
                                "FAILED",
                                f"{type(q_err).__name__}: {str(q_err)}",
                            )
                        ]
                        excel_export.export_query_results_to_sheet(
                            wb, q_id, error_headers, error_rows
                        )

        # 3. Save the Excel workbook if at least one sheet was written
        if successful_count > 0 or failed_count > 0:
            excel_export.save_workbook(wb, config.OUTPUT_FILE)

    except Exception as db_err:
        logger.critical(
            f"Critical database connection or session error: {db_err}",
            exc_info=True,
        )
        sys.exit(1)

    end_time = time.time()
    duration = end_time - start_time

    # 4. Generate summary screen report
    summary = f"""
==================================================
              EXECUTION SUMMARY
==================================================
Queries executed : {total_queries}
Successful       : {successful_count}
Failed           : {failed_count}
Excel saved      : {config.OUTPUT_FILE.relative_to(Path.cwd()) if config.OUTPUT_FILE.is_relative_to(Path.cwd()) else config.OUTPUT_FILE}
Execution Time   : {duration:.2f} seconds
==================================================
"""
    # Print the summary to terminal and write to log
    print(summary)
    logger.info("Process finished.")


if __name__ == "__main__":
    main()
