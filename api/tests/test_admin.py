import unittest
from datetime import date, timedelta
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.routers.admin import _stale_warnings, get_admin_user


class TestAdmin(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        app.dependency_overrides[get_admin_user] = lambda: "admin-uuid"

    def tearDown(self):
        app.dependency_overrides.clear()

    @patch("app.routers.admin.supabase")
    @patch("app.routers.admin.run_validation")
    def test_admin_health_telemetry(self, mock_run_validation, mock_supabase):
        # Mock run_validation
        mock_report = MagicMock()
        mock_report.total_issues = 0
        mock_report.to_dict.return_value = {"checks": []}
        mock_run_validation.return_value = mock_report

        # Dates
        today = date.today()
        two_days_ago = (today - timedelta(days=2)).isoformat()
        ten_days_ago = (today - timedelta(days=10)).isoformat()
        five_days_ago = (today - timedelta(days=5)).isoformat()

        # Mock pokemon_usage
        mock_usage = MagicMock()
        mock_usage.select.return_value.execute.return_value.data = [
            {"format": "doubles", "snapshot_date": ten_days_ago}
        ]

        # Mock meta_snapshots
        mock_meta = MagicMock()
        mock_meta.select.return_value.execute.return_value.data = [
            {"format": "singles", "snapshot_date": two_days_ago}
        ]

        # Mock tournament_teams
        mock_teams = MagicMock()
        # The chain for tournament_teams is .select().order().limit().execute()
        teams_execute = mock_teams.select.return_value.order.return_value.limit.return_value.execute
        teams_execute.return_value.data = [{"created_at": five_days_ago}]

        # Mock cron_runs
        mock_cron = MagicMock()
        cron_execute = mock_cron.select.return_value.order.return_value.limit.return_value.execute
        cron_execute.return_value.data = []

        def get_table(table_name):
            if table_name == "pokemon_usage":
                return mock_usage
            if table_name == "meta_snapshots":
                return mock_meta
            if table_name == "tournament_teams":
                return mock_teams
            if table_name == "cron_runs":
                return mock_cron
            return MagicMock()

        mock_supabase.table.side_effect = get_table

        response = self.client.get("/admin/data-health")
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # oldest_data_age_days should be max(10, 2, 5) = 10
        self.assertEqual(data["oldest_data_age_days"], 10)
        self.assertEqual(data["tournament_teams_age_days"], 5)
        self.assertEqual(data["latest_pokemon_usage_per_format"]["doubles"]["days_old"], 10)
        self.assertEqual(data["latest_meta_snapshot_per_format"]["singles"]["days_old"], 2)

    @patch("app.routers.admin.supabase")
    @patch("app.routers.admin.run_validation")
    def test_admin_health_telemetry_empty(self, mock_run_validation, mock_supabase):
        mock_report = MagicMock()
        mock_report.total_issues = 0
        mock_report.to_dict.return_value = {"checks": []}
        mock_run_validation.return_value = mock_report

        mock_supabase.table.return_value.select.return_value.execute.return_value.data = []
        execute = (
            mock_supabase.table.return_value.select.return_value.order.return_value.limit
            .return_value.execute
        )
        execute.return_value.data = []

        response = self.client.get("/admin/data-health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsNone(data["oldest_data_age_days"])

    def test_staged_cron_rows_do_not_count_as_zero_row_warning(self):
        warnings = _stale_warnings(
            usage_by_format={"doubles": {"date": date.today().isoformat(), "days_old": 0}},
            last_runs=[
                {
                    "source": "pikalytics",
                    "status": "warn",
                    "rows_inserted": 0,
                    "rows_updated": 0,
                    "rows_staged": 12,
                }
            ],
        )

        self.assertEqual(warnings, [])
