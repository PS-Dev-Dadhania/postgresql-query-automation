"""Excel export module to compile SQL query results into a styled workbook."""

import logging
from decimal import Decimal
import datetime
from pathlib import Path
from typing import Any, List, Tuple
import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

# Set up logging for this module
logger = logging.getLogger(__name__)


def create_styled_workbook() -> openpyxl.Workbook:
    """Creates a new workbook and removes the default sheet.

    Returns:
        openpyxl.Workbook: The empty, styled workbook.
    """
    wb = openpyxl.Workbook()
    # Remove the default sheet created by openpyxl
    wb.remove(wb.active)
    return wb


def export_query_results_to_sheet(
    wb: openpyxl.Workbook,
    sheet_name: str,
    headers: List[str],
    rows: List[Tuple[Any, ...]],
) -> None:
    """Writes query results to a worksheet and applies professional styling.

    Args:
        wb: openpyxl Workbook instance.
        sheet_name: Name of the sheet (e.g. 'Q1').
        headers: List of column header names.
        rows: List of data records.
    """
    logger.info(
        f"Writing sheet '{sheet_name}' with {len(rows)} rows..."
    )
    ws = wb.create_sheet(title=sheet_name)

    # 1. Write the headers
    ws.append(headers)

    # 2. Write the data rows, converting types where necessary
    for row in rows:
        cleaned_row = []
        for val in row:
            # Psycopg2 Decimal objects are supported by openpyxl, but converting
            # to float is sometimes safer; let's keep Decimal or convert to float
            # if they are monetary values to prevent write issues.
            if isinstance(val, Decimal):
                cleaned_row.append(float(val))
            elif isinstance(val, (datetime.datetime, datetime.date)):
                cleaned_row.append(val)
            elif val is None:
                cleaned_row.append("")
            else:
                cleaned_row.append(val)
        ws.append(cleaned_row)

    # 3. Apply Premium Styles
    # Font settings
    header_font = Font(name="Segoe UI", size=11, bold=True, color="1F497D")
    data_font = Font(name="Segoe UI", size=10)

    # Header fill (Light steel/ice blue for a premium financial report feel)
    header_fill = PatternFill(
        start_color="DCE6F1", end_color="DCE6F1", fill_type="solid"
    )

    # Borders: Thin light grey lines
    thin_border_side = Side(style="thin", color="D3D3D3")
    thin_border = Border(
        left=thin_border_side,
        right=thin_border_side,
        top=thin_border_side,
        bottom=thin_border_side,
    )

    # Alignments
    header_alignment = Alignment(
        horizontal="center", vertical="center", wrap_text=True
    )
    left_alignment = Alignment(horizontal="left", vertical="center")
    right_alignment = Alignment(horizontal="right", vertical="center")
    center_alignment = Alignment(horizontal="center", vertical="center")

    # Freeze the top row (headers always visible while scrolling)
    ws.freeze_panes = "A2"

    # Style Header Cells
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
        cell.border = thin_border

    # Style Data Cells
    for r_idx in range(2, len(rows) + 2):
        for c_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=r_idx, column=c_idx)
            cell.font = data_font
            cell.border = thin_border

            # Deduce alignment based on data type
            val = cell.value
            if isinstance(val, (int, float)):
                cell.alignment = right_alignment
                # Format money-like fields or general floats nicely
                if isinstance(val, float):
                    cell.number_format = "#,##0.00"
                else:
                    cell.number_format = "#,##0"
            elif isinstance(val, (datetime.datetime, datetime.date)):
                cell.alignment = center_alignment
                cell.number_format = "yyyy-mm-dd"
            else:
                cell.alignment = left_alignment

    # Auto-adjust column widths
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val = cell.value
            if val is not None:
                # Format dates to string length before measuring
                if isinstance(val, (datetime.datetime, datetime.date)):
                    val_str = val.strftime("%Y-%m-%d")
                elif isinstance(val, float):
                    val_str = f"{val:,.2f}"
                else:
                    val_str = str(val)

                # Find longest line in case of newline split
                for line in val_str.split("\n"):
                    if len(line) > max_len:
                        max_len = len(line)

        # Set width: max content length + padding, subject to a minimum & maximum limits
        ws.column_dimensions[col_letter].width = max(
            min(max_len + 4, 50), 12
        )


def save_workbook(wb: openpyxl.Workbook, file_path: Path) -> None:
    """Saves the workbook to the specified file path, creating parent directories if needed.

    Args:
        wb: openpyxl Workbook instance.
        file_path: Output file destination path.
    """
    logger.info(f"Saving workbook to '{file_path}'...")
    file_path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(str(file_path))
    logger.info("Workbook saved successfully.")
