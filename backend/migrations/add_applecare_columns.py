"""Add AppleCare warranty columns to assets table.

Run this once after pulling:
  docker-compose exec backend python migrations/add_applecare_columns.py
"""
import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost/asset_tracker")
engine = create_engine(DATABASE_URL)

COLUMNS = [
    ("applecare_status", "VARCHAR(50)"),
    ("applecare_description", "VARCHAR(200)"),
    ("applecare_start_date", "TIMESTAMP"),
    ("applecare_end_date", "TIMESTAMP"),
    ("applecare_agreement_number", "VARCHAR(200)"),
    ("applecare_is_renewable", "BOOLEAN"),
    ("applecare_payment_type", "VARCHAR(100)"),
]

def migrate():
    with engine.connect() as conn:
        for col_name, col_type in COLUMNS:
            try:
                conn.execute(text(
                    f"ALTER TABLE assets ADD COLUMN IF NOT EXISTS {col_name} {col_type}"
                ))
                print(f"  ✓ Added column: {col_name} ({col_type})")
            except Exception as e:
                print(f"  ⚠ Column {col_name}: {e}")
        conn.commit()
    print("\n✅ AppleCare columns migration complete.")

if __name__ == "__main__":
    print("Adding AppleCare warranty columns to assets table...\n")
    migrate()
