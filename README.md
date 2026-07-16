# PostgreSQL Studio Workspace & Report Generator

## Short Description
A premium, production-grade desktop-like web application and SQL Studio Client that connects to a **dvdrental** PostgreSQL database. It allows developers, analysts, and DBAs to manually type, execute, and preview SQL exercise queries (Q1 to Q15), explore schemas, and compile successful datasets into a single professionally styled Excel workbook (`sql_exercise_outputs.xlsx`).

---

## Features
- **IDE-grade Desktop Experience** – Inspired by tools like **DataGrip**, **DBeaver**, and **VS Code**.
- **Collapsible Schema Explorer** – Collapsible tree node visualization showing all tables and columns (with data types) dynamically fetched from PostgreSQL.
- **Exercises Catalog Sidebar** – Direct navigation for exercises Q1 to Q15 with progress state tracking (○ Pending, ✓ Success, ✕ Failed).
- **Monaco SQL Editor Workspace** – Advanced editor featuring syntax highlighting, line numbers, autocomplete, reset templates, and draft auto-saving.
- **Interactive Results Grid** – Professional datagrid supporting horizontal/vertical scrolling, sortable columns, CSV export, and DBeaver-style multi-cell copying to clipboard.
- **Troubleshooting & Error Diagnostics** – Explains SQL syntax or schema errors with exact locations and troubleshooting tips.
- **Active Operations Dashboard** – Real-time progress stats, completion rate bar, database configuration summaries, and query executions telemetry.
- **Excel Report Builder** – Compiles successfully executed query sheets into a beautifully styled spreadsheet (using Segoe UI fonts, steel-blue fills, thin borders, numbers formats, and auto-adjusted column dimensions). Skips unexecuted or empty questions.
- **Theme Options** – Instant toggling between Dark Theme (DataGrip inspired) and Light Theme (Clean Studio inspired).

---

## Technologies Used
| Technology | Role |
|------------|------|
| **Python 3.x** | Backend core server |
| **Flask** | REST API endpoints provider & static assets server |
| **psycopg2** | PostgreSQL driver |
| **openpyxl** | Excel report compilation and cell formatting |
| **Monaco Editor (CDN)** | IDE-grade SQL editor |
| **Vanilla HTML5 & CSS3** | Custom-themed layout styling |
| **pathlib** | OS-independent directory paths resolver |

---

## Project Structure
```
SQL/
├── static/
│   ├── index.html        # Main interface dashboard structure
│   ├── style.css         # VSCode/DataGrip custom stylesheets (Light + Dark)
│   ├── app.js            # Client-side routing, tree render, grid, and compiler triggers
├── config.py             # Loads & validates environment configuration
├── db.py                 # Handles connection pooling & transaction states
├── queries.py            # Predefined query objective templates and solutions metadata
├── excel_export.py       # Openpyxl styles compiling and excel workbook saving
├── main.py               # Flask application server endpoints
├── requirements.txt      # Project library dependencies list
└── output/
    └── sql_exercise_outputs.xlsx   # Generated styled Excel report
```

---

## Installation & Setup

```bash
# 1. Clone the repository
git clone https://github.com/PS-Dev-Dadhania/postgresql-query-automation.git
cd postgresql-query-automation

# 2. Create a virtual environment
python -m venv .venv
source .venv/Scripts/activate   # Windows PowerShell
# or: .venv\Scripts\activate.bat

# 3. Install requirements
pip install -r requirements.txt

# 4. Prepare environment variables
cp .env.example .env
# Edit .env with your PostgreSQL credentials:
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=dvdrental
# DB_USER=postgres
# DB_PASSWORD=devd7180   # <-- your database password
```

<<<<<<< HEAD
## Configuration
| Variable | Description | Example |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | Port number | `5432` |
| `DB_NAME` | Database name | `dvdrental` |
| `DB_USER` | DB user | `postgres` |
| `DB_PASSWORD` | User password (required) | `chrisgayle` |
| `OUTPUT_DIR` | Folder for generated workbook (auto-created) | `output/` |
| `OUTPUT_FILE` | Full path of the Excel file | `output/sql_exercise_outputs.xlsx` |
=======
---
>>>>>>> e311478 (Redesign: Premium SQL Studio Workspace & Enhanced Excel Reports)

## Running the Application

```bash
python main.py
```
This runs the local server on `http://127.0.0.1:5000/` and automatically launches a new browser tab. 

### Core Workflows

1. **Establish DB Connection**: Head to the **Database** tab, input connection details (pre-filled from `.env`), test connection, and click **Connect**.
2. **Execute Queries**: Navigate to the **Workspace** tab. Choose any exercise (Q1-Q15) in the Exercises Catalog, write or load standard solutions template inside the Monaco Editor, and hit **Run Query** (or press `Ctrl+Enter` / `F5`).
3. **Analyze Results**: Review columns headers in the resizable Results Grid, sort tables, copy selected cell blocks, or export results directly as a CSV document.
4. **Build Excel Reports**: Head to the **Export** tab and click **Compile & Save Excel Document** to compile all query worksheet results.

---

## Error Handling
- **Database Connection**: Validated on parameters test connection. Reports clean stack logs if server auth fails (e.g. invalid password).
- **SQL Execution**: isolated transaction blocks ensure errors roll back the database transaction block gracefully without closing the active connection. Error diagnostics present clean descriptions in the details drawer.
- **Workbook Saving**: Validates that worksheets are populated with active rows datasets. Unexecuted queries are dynamically skipped from compile payloads.

---

## License
MIT License – feel free to use, modify, and distribute.
