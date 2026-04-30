"""DEPRECATED: Refresh Champions meta data.

This script is deprecated as of 2026-04-16. All meta data ingestion (Smogon,
Pikalytics, Limitless) has been moved to a cron-driven architecture.

Please use the admin cron endpoints instead:
- /admin/cron/ingest-smogon
- /admin/cron/ingest-pikalytics
- /admin/cron/ingest-limitless

See api/app/routers/admin_cron.py for implementation details.
"""

import sys


def main() -> None:
    print(
        "refresh_meta.py is DEPRECATED.\n"
        "Use the cron-driven ingest via /admin/cron/ endpoints instead.\n"
        "See api/app/routers/admin_cron.py for details."
    )
    sys.exit(0)


if __name__ == "__main__":
    main()
