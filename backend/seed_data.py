"""
HAM — Hardware Asset Manager — Demo Seed Data

Populates the database with realistic fake assets so you can evaluate
the full UI without connecting a live MDM or identity provider.

Usage:
    python seed_data.py                  # seed ~50 assets
    python seed_data.py --count 100      # seed a specific number
    python seed_data.py --clear          # wipe all assets and reseed
    python seed_data.py --wipe           # wipe only, no reseed

Or via Docker Compose:
    docker compose exec backend python seed_data.py
    docker compose exec backend python seed_data.py --clear

Or via Makefile:
    make seed
    make seed-clear
"""

import argparse
import os
import random
import string
import sys
from datetime import datetime, timedelta

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import (
    Asset, AssetStatus, AssetCondition, AuditLog,
    Base, FleetSyncLog, ABMSyncLog
)

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost/asset_tracker")
ASSET_TAG_PREFIX = os.getenv("ASSET_TAG_PREFIX", "HAM")
LOCATIONS = [loc.strip() for loc in os.getenv("LOCATIONS", "HQ,Remote").split(",") if loc.strip()]

# ---------------------------------------------------------------------------
# Fake data pools
# ---------------------------------------------------------------------------

MACOS_MODELS = [
    ("Apple", "MacBook Pro 16\" M3 Max", "macOS", "14.4", "Apple M3 Max", 48, 1024, 16.0, 3499.00),
    ("Apple", "MacBook Pro 14\" M3 Pro", "macOS", "14.4", "Apple M3 Pro", 36, 512, 14.2, 1999.00),
    ("Apple", "MacBook Pro 16\" M2 Max", "macOS", "14.3", "Apple M2 Max", 32, 1024, 16.0, 3299.00),
    ("Apple", "MacBook Pro 14\" M2 Pro", "macOS", "14.3", "Apple M2 Pro", 16, 512, 14.2, 1999.00),
    ("Apple", "MacBook Air 15\" M3",     "macOS", "14.4", "Apple M3",     16, 512, 15.3, 1299.00),
    ("Apple", "MacBook Air 13\" M3",     "macOS", "14.4", "Apple M3",     16, 256, 13.6, 1099.00),
    ("Apple", "MacBook Air 13\" M2",     "macOS", "14.2", "Apple M2",     8,  256, 13.6, 1099.00),
    ("Apple", "Mac mini M2 Pro",         "macOS", "14.3", "Apple M2 Pro", 32, 512, None, 1299.00),
    ("Apple", "Mac mini M2",             "macOS", "14.3", "Apple M2",     8,  256, None, 599.00),
    ("Apple", "iMac 24\" M3",            "macOS", "14.4", "Apple M3",     24, 512, 23.5, 1699.00),
]

WINDOWS_MODELS = [
    ("Dell",    "XPS 15 9530",          "Windows", "11", "Intel Core i9-13900H", 32, 1024, 15.6, 2499.00),
    ("Dell",    "XPS 13 9340",          "Windows", "11", "Intel Core i7-1360P",  16, 512,  13.4, 1299.00),
    ("Dell",    "Latitude 5540",        "Windows", "11", "Intel Core i7-1365U",  16, 512,  15.6, 1199.00),
    ("Lenovo",  "ThinkPad X1 Carbon",   "Windows", "11", "Intel Core i7-1365U",  16, 512,  14.0, 1499.00),
    ("Lenovo",  "ThinkPad T14s Gen 4",  "Windows", "11", "AMD Ryzen 7 PRO 7840U", 32, 512, 14.0, 1399.00),
    ("HP",      "EliteBook 840 G10",    "Windows", "11", "Intel Core i7-1355U",  16, 512,  14.0, 1299.00),
    ("Microsoft", "Surface Pro 9",      "Windows", "11", "Intel Core i7-1265U",  16, 256,  13.0, 1599.00),
]

IPHONE_MODELS = [
    ("Apple", "iPhone 15 Pro Max", "iOS",   "17.4", None, None, None, None, 1199.00),
    ("Apple", "iPhone 15 Pro",     "iOS",   "17.4", None, None, None, None, 999.00),
    ("Apple", "iPhone 15",         "iOS",   "17.4", None, None, None, None, 799.00),
    ("Apple", "iPhone 14 Pro",     "iOS",   "17.3", None, None, None, None, 899.00),
]

IPAD_MODELS = [
    ("Apple", "iPad Pro 12.9\" M2", "iPadOS", "17.4", "Apple M2", 16, 512, 12.9, 1099.00),
    ("Apple", "iPad Pro 11\" M4",   "iPadOS", "17.4", "Apple M4", 16, 256, 11.0, 999.00),
    ("Apple", "iPad Air 13\" M2",   "iPadOS", "17.4", "Apple M2", 8,  256, 13.0, 799.00),
]

FIRST_NAMES = [
    "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Jamie",
    "Avery", "Quinn", "Blake", "Drew", "Parker", "Skyler", "Cameron",
    "Reese", "Finley", "Emerson", "Harper", "Logan", "Peyton"
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
    "Davis", "Wilson", "Anderson", "Thomas", "Jackson", "White", "Harris",
    "Martin", "Thompson", "Lee", "Walker", "Hall", "Allen"
]

DEPARTMENTS = [
    "Engineering", "Product", "Design", "Finance", "Operations",
    "Marketing", "Sales", "Legal", "HR", "IT"
]

SUPPLIERS = ["Apple", "Dell", "CDW", "Insight", "Connection", "SHI"]

ABM_PRODUCT_FAMILIES = {
    "macOS": "Mac",
    "iOS": "iPhone",
    "iPadOS": "iPad",
}

APPLECARE_PLANS = [
    ("Active",  "AppleCare+ for Mac",    True,  "Monthly"),
    ("Active",  "AppleCare+ for Mac",    True,  "Upfront"),
    ("Active",  "AppleCare for Mac",     False, "Upfront"),
    ("Expired", "AppleCare+ for Mac",    False, "Upfront"),
    (None,      None,                    None,  None),  # no AppleCare
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def rand_serial() -> str:
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=12))


def rand_fleet_id() -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=8)) + \
           "-" + "".join(random.choices(string.ascii_lowercase + string.digits, k=4))


def rand_abm_id() -> str:
    return "".join(random.choices(string.digits, k=15))


def rand_order_number() -> str:
    return "ORD-" + "".join(random.choices(string.digits, k=8))


def rand_applecare_agreement() -> str:
    return "APP-" + "".join(random.choices(string.digits, k=10))


def rand_hostname(first: str, last: str, model: str) -> str:
    short_model = model.split()[1].lower().replace('"', '').replace("'", "")
    return f"{first.lower()}-{last.lower()}-{short_model}"


def rand_email(first: str, last: str) -> str:
    return f"{first.lower()}.{last.lower()}@example.com"


def days_ago(n: int) -> datetime:
    return datetime.utcnow() - timedelta(days=n)


def days_from_now(n: int) -> datetime:
    return datetime.utcnow() + timedelta(days=n)


# ---------------------------------------------------------------------------
# Asset builder
# ---------------------------------------------------------------------------

def build_asset(idx: int, scenario: str) -> Asset:
    """
    Build a single Asset with a specific scenario to ensure all
    UI states are represented in the seed data.

    Scenarios:
      assigned        - device assigned to a user, fleet enrolled
      available       - unassigned, sitting in inventory
      locked          - MDM locked, no user
      warranty_expiring - assigned, warranty expires in < 30 days
      unassigned_old  - available but unassigned for 90+ days
      retired         - retired device
      no_abm          - assigned device with no ABM/AppleCare data
      windows         - Windows device
      iphone          - iPhone
      ipad            - iPad
    """
    tag = f"{ASSET_TAG_PREFIX}-DEMO{idx:04d}"
    serial = rand_serial()
    location = random.choice(LOCATIONS)

    first = random.choice(FIRST_NAMES)
    last = random.choice(LAST_NAMES)
    dept = random.choice(DEPARTMENTS)

    # Pick device pool based on scenario
    if scenario == "windows":
        pool = WINDOWS_MODELS
        device_type = "laptop"
    elif scenario == "iphone":
        pool = IPHONE_MODELS
        device_type = "phone"
    elif scenario == "ipad":
        pool = IPAD_MODELS
        device_type = "tablet"
    else:
        pool = MACOS_MODELS
        device_type = "laptop"

    mfr, model, os_type, os_ver, cpu, ram, storage, screen, cost = random.choice(pool)

    # Purchase date — spread across 0.5 to 4.5 years ago
    purchase_days_ago = random.randint(180, 1640)
    purchase_date = days_ago(purchase_days_ago)
    supplier = random.choice(SUPPLIERS) if mfr != "Apple" else "Apple"

    asset = Asset(
        asset_tag=tag,
        serial_number=serial,
        manufacturer=mfr,
        model=model,
        device_type=device_type,
        hostname=rand_hostname(first, last, model) if scenario not in ("available", "locked", "unassigned_old", "retired") else None,
        os_type=os_type,
        os_version=os_ver,
        processor=cpu,
        ram_gb=ram,
        storage_gb=storage,
        screen_size=screen,
        purchase_date=purchase_date,
        purchase_cost=cost,
        supplier=supplier,
        location=location,
        fleet_enrolled=scenario not in ("retired",),
        fleet_sync_enabled=True,
        fleet_device_id=rand_fleet_id() if scenario not in ("retired",) else None,
        fleet_last_seen=days_ago(random.randint(0, 14)) if scenario not in ("retired",) else None,
        created_by="seed_data",
        updated_by="seed_data",
        created_at=purchase_date,
        updated_at=purchase_date,
    )

    # ---- Scenario-specific fields ----------------------------------------

    if scenario in ("assigned", "warranty_expiring", "no_abm"):
        asset.assigned_to = f"{first} {last}"
        asset.assigned_email = rand_email(first, last)
        asset.assigned_username = f"{first.lower()}.{last.lower()}"
        asset.department = dept
        asset.assignment_date = days_ago(random.randint(30, 400))
        asset.status = AssetStatus.ASSIGNED
        asset.condition = random.choice([AssetCondition.EXCELLENT, AssetCondition.GOOD])

    elif scenario == "available":
        asset.status = AssetStatus.AVAILABLE
        asset.condition = random.choice([AssetCondition.NEW, AssetCondition.EXCELLENT, AssetCondition.GOOD])
        asset.storage_location = random.choice(["IT Room Shelf A", "IT Room Shelf B", "Storage Cabinet", None])

    elif scenario == "locked":
        asset.status = AssetStatus.LOCKED
        asset.condition = AssetCondition.GOOD
        asset.notes = "Device locked via MDM — pending user offboarding investigation."

    elif scenario == "warranty_expiring":
        # Override warranty to expire in 5-28 days
        asset.warranty_expiration = days_from_now(random.randint(5, 28))

    elif scenario == "unassigned_old":
        asset.status = AssetStatus.AVAILABLE
        asset.condition = random.choice([AssetCondition.GOOD, AssetCondition.FAIR])
        # Last assigned 100+ days ago, now sitting unassigned
        asset.notes = "Returned from offboarded employee. Pending redeployment."
        asset.storage_location = "IT Room Shelf A"

    elif scenario == "retired":
        asset.status = AssetStatus.RETIRED
        asset.condition = AssetCondition.POOR
        asset.fleet_enrolled = False
        asset.notes = "Retired — end of useful life."

    elif scenario in ("iphone", "ipad"):
        asset.assigned_to = f"{first} {last}"
        asset.assigned_email = rand_email(first, last)
        asset.assigned_username = f"{first.lower()}.{last.lower()}"
        asset.department = dept
        asset.assignment_date = days_ago(random.randint(30, 400))
        asset.status = AssetStatus.ASSIGNED
        asset.condition = AssetCondition.GOOD

    elif scenario == "windows":
        asset.assigned_to = f"{first} {last}"
        asset.assigned_email = rand_email(first, last)
        asset.assigned_username = f"{first.lower()}.{last.lower()}"
        asset.department = dept
        asset.assignment_date = days_ago(random.randint(30, 400))
        asset.status = AssetStatus.ASSIGNED
        asset.condition = random.choice([AssetCondition.EXCELLENT, AssetCondition.GOOD])

    # ---- ABM data (Apple devices only, not 'no_abm' scenario) ------------

    if mfr == "Apple" and scenario != "no_abm" and scenario != "retired":
        asset.abm_device_id = rand_abm_id()
        asset.abm_status = "ACTIVATED" if asset.status == AssetStatus.ASSIGNED else "AVAILABLE_TO_DEPLOY"
        asset.abm_order_number = rand_order_number()
        asset.abm_order_date = purchase_date
        asset.abm_product_family = ABM_PRODUCT_FAMILIES.get(os_type, "Mac")
        asset.abm_product_type = model
        asset.abm_device_capacity = f"{storage}GB" if storage else "256GB"
        asset.abm_color = random.choice(["Space Gray", "Silver", "Space Black", "Starlight", "Midnight"])
        asset.abm_added_date = purchase_date
        asset.abm_purchase_source = "APPLE_STORE"
        asset.abm_last_synced = days_ago(1)

        # ---- AppleCare (only for Mac, not iPhone/iPad for simplicity) ----
        if os_type == "macOS" and scenario != "warranty_expiring":
            plan = random.choice(APPLECARE_PLANS)
            ac_status, ac_desc, ac_renewable, ac_payment = plan
            if ac_status:  # has AppleCare
                start = purchase_date
                end = purchase_date + timedelta(days=365 * 3)  # 3-year coverage
                asset.applecare_status = ac_status
                asset.applecare_description = ac_desc
                asset.applecare_start_date = start
                asset.applecare_end_date = end
                asset.applecare_agreement_number = rand_applecare_agreement()
                asset.applecare_is_renewable = ac_renewable
                asset.applecare_payment_type = ac_payment
                # Use AppleCare end date as warranty expiration
                asset.warranty_expiration = end
            else:
                # Standard 1-year limited warranty
                asset.warranty_expiration = purchase_date + timedelta(days=365)
        elif scenario != "warranty_expiring":
            asset.warranty_expiration = purchase_date + timedelta(days=365)
    elif scenario != "warranty_expiring":
        # Windows — standard warranty
        asset.warranty_expiration = purchase_date + timedelta(days=365 * 3)

    return asset


# ---------------------------------------------------------------------------
# Scenario distribution
# ---------------------------------------------------------------------------

def get_scenarios(count: int) -> list:
    """
    Return a list of scenarios that covers all key UI states,
    scaled to the requested count.
    """
    base = [
        # ~50% assigned macOS
        *(["assigned"] * 22),
        # ~15% available macOS
        *(["available"] * 7),
        # ~8% locked
        *(["locked"] * 4),
        # ~6% warranty expiring soon (shows dashboard alert)
        *(["warranty_expiring"] * 3),
        # ~6% unassigned too long (shows Slack alert threshold)
        *(["unassigned_old"] * 3),
        # ~4% retired
        *(["retired"] * 2),
        # ~4% no ABM data
        *(["no_abm"] * 2),
        # ~8% Windows
        *(["windows"] * 4),
        # ~4% iPhone
        *(["iphone"] * 2),
        # ~4% iPad  
        *(["ipad"] * 1),
    ]  # = 50 total

    if count <= len(base):
        return base[:count]

    # Scale up by repeating proportionally
    factor = count / len(base)
    scaled = []
    for scenario in set(base):
        n = max(1, round(base.count(scenario) * factor))
        scaled.extend([scenario] * n)

    # Trim or pad with 'assigned' to hit exact count
    while len(scaled) > count:
        scaled.pop()
    while len(scaled) < count:
        scaled.append("assigned")

    random.shuffle(scaled)
    return scaled


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def seed(count: int = 50, clear: bool = False, wipe_only: bool = False):
    engine = create_engine(DATABASE_URL)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        if clear or wipe_only:
            print("Clearing existing assets and audit logs...")
            db.query(AuditLog).delete()
            db.query(Asset).delete()
            db.commit()
            print("Cleared.")

            if wipe_only:
                print("Done.")
                return

        # Check how many already exist
        existing = db.query(Asset).count()
        if existing > 0 and not clear:
            print(f"Database already has {existing} assets. Use --clear to wipe and reseed.")
            return

        print(f"Seeding {count} demo assets...")
        scenarios = get_scenarios(count)
        random.shuffle(scenarios)

        created = 0
        for idx, scenario in enumerate(scenarios, start=1):
            asset = build_asset(idx, scenario)
            db.add(asset)
            db.flush()  # get asset.id for audit log

            # Add a seed audit log entry
            db.add(AuditLog(
                asset_id=asset.id,
                action="created",
                new_value=f"Seeded via seed_data.py (scenario: {scenario})",
                user_email="seed_data@ham.local",
                user_name="Seed Script",
                timestamp=asset.created_at,
            ))
            created += 1

        db.commit()

        # Summary
        status_counts = {}
        for asset in db.query(Asset).all():
            s = asset.status.value if asset.status else "unknown"
            status_counts[s] = status_counts.get(s, 0) + 1

        print(f"\n✅ Seeded {created} assets:")
        for status, n in sorted(status_counts.items()):
            print(f"   {status:12s} {n}")
        print(f"\nOpen http://localhost:3000 to explore the UI.")
        print(f"Login is still required — see docs/okta.md or issue #1 for local auth.\n")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="HAM demo seed data")
    parser.add_argument("--count", type=int, default=50, help="Number of assets to create (default: 50)")
    parser.add_argument("--clear", action="store_true", help="Wipe existing assets and reseed")
    parser.add_argument("--wipe", action="store_true", help="Wipe existing assets only, no reseed")
    args = parser.parse_args()

    seed(count=args.count, clear=args.clear, wipe_only=args.wipe)
