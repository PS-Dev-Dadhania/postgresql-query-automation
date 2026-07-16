# Python SQL Automation Project: dvdrental Query Executor & Excel Report Generator

A production-quality Python automation utility that executes 15 advanced SQL exercises against a PostgreSQL `dvdrental` database and exports the results into a professionally formatted, styled, and multi-sheet Excel workbook.

---

## Folder Structure

```text
SQL_Automation_Project/
├── queries.py          # SQL queries registry (Q1 - Q15) and metadata
├── db.py               # Reusable database connection context manager
├── excel_export.py     # openpyxl excel writer, formatter, and styles
├── config.py           # dotenv configuration loader and validator
├── main.py             # Main execution orchestrator
├── .env.example        # Environment variables template file
├── .env                # Local environment configuration (git-ignored)
├── requirements.txt    # Project dependencies list
└── output/
    └── sql_exercise_outputs.xlsx  # Generated Excel report
```

---

## Requirements

- Python 3.10+
- PostgreSQL 12+ (with the `dvdrental` database loaded)
- Python Packages:
  - `psycopg2-binary`
  - `openpyxl`
  - `python-dotenv`
  - `tqdm`

---

## Database Setup

If the `dvdrental` database is not yet loaded into your PostgreSQL server, you can restore it from the official PostgreSQL sample tarball:

1. Create a new database in PostgreSQL named `dvdrental`:
   ```sql
   CREATE DATABASE dvdrental;
   ```
2. Restore the database from the `dvdrental.tar` file (e.g. using `pg_restore`):
   ```bash
   pg_restore -U postgres -d dvdrental /path/to/dvdrental.tar
   ```

---

## Installation & Setup

1. Clone or copy the project files to your working directory.
2. Install the python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Copy the environment template file:
   ```bash
   copy .env.example .env
   ```
4. Open the `.env` file and configure your PostgreSQL database credentials:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=dvdrental
   DB_USER=postgres
   DB_PASSWORD=your_secure_password
   ```

---

## How to Run

Execute the orchestrator script using python:
```bash
python main.py
```

---

## Expected Output

Upon successful execution, the tool outputs an interactive progress bar, detailed log information, and prints a final execution summary to the console:

```text
==================================================
              EXECUTION SUMMARY
==================================================
Queries executed : 15
Successful       : 15
Failed           : 0
Excel saved      : output/sql_exercise_outputs.xlsx
Execution Time   : 0.84 seconds
==================================================
```

A spreadsheet named `sql_exercise_outputs.xlsx` is created in the `output/` directory containing 15 sheets: `Q1` to `Q15`.

### Excel Styling Details:
- **Tabs**: Dynamically labeled from `Q1` to `Q15`.
- **First Row**: Contains column headers, frozen (scrolls with data), bolded, and colored with a premium light steel-blue background fill.
- **Grid Layout**: All header and data cells have thin borders.
- **Alignment**: Column headers are center-aligned; text fields are left-aligned; numerical / currency fields are right-aligned.
- **Formatting**: Decimals and financial statistics are formatted to two decimal points (`#,##0.00`) and integers are formatted as `#,##0`. Dates are centered and formatted as `yyyy-mm-dd`.
- **Auto-fit Columns**: Column widths automatically scale based on the length of values inside them with built-in padding.

---

## Screenshots & Visuals

*(Screenshots Placeholder: Insert Excel sheet overview and terminal execution progress here)*

---

## Troubleshooting

1. **Database connection failed (OperationalError)**:
   - Ensure the PostgreSQL server is running.
   - Verify the port, host, username, and password in the `.env` file.
2. **Missing Configuration Exception**:
   - Make sure you copied `.env.example` to `.env` and filled in all variables. Do not delete keys.
3. **Failed Query Recovery**:
   - If one of the queries fails (due to syntax, permissions, or missing views), the orchestrator will catch the exception, log it, rollback the transaction state for that query, record the failure status in the corresponding worksheet tab, and continue running the rest of the exercises. Check the `execution.log` file for the full error traceback.
