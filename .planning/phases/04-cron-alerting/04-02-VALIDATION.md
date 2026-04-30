# Phase 04-02 Validation Strategy: Cron Alerting Integration

## Automated Verification
1. **Cron Integration:**
    - Invoke `/admin/cron/test-alert` via `curl`.
    - Verify response code 500.
    - Check `cron_runs` table for the recorded failure.
2. **Compliance Docs:**
    - `grep "Slack/Discord" LEGAL_AND_DEV_GUIDELINES.md`
    - `grep "Slack/Discord" web/src/app/privacy/page.tsx`

## Manual Verification
1. **Real-world Notification:**
    - Trigger `/admin/cron/test-alert` with a live webhook URL configured.
    - Confirm the message format and content in the target channel.
