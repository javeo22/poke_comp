# Phase 8-01 Summary: Database Fix & Format Consolidation

I have resolved the critical blockers in the Admin Review queue and streamlined the platform by consolidating competitive formats.

## Key Changes
- **Admin Fix:** Granted `is_admin` privileges to the developer user in the `user_profiles` table, resolving the "missing table" RLS policy block for the scraper review queue.
- **Format Consolidation:** Removed the redundant 'Megas' format from all backend Pydantic models (MetaSnapshot, Team, DraftRequest) and frontend TypeScript types. Megas are now treated as build options within standard formats rather than a separate competitive ladder.
- **API Cleanup:** Updated the meta, teams, and cheatsheet routers to remove stale 'megas' logic and documentation.
- **UI Alignment:** Cleaned up the `TeamCard` and dropdown selectors to focus exclusively on Singles and Doubles.

## Verification
- Verified that the `/admin/review` page now loads successfully and displays the review queue.
- Confirmed that the "Format" dropdowns across the site no longer list "Megas".
- Ran frontend type checks (`tsc`) to ensure no broken references remain.
