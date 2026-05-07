import os

from dotenv import load_dotenv
from supabase import Client, create_client


def seed_user():
    # Load .env explicitly
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    load_dotenv(env_path)

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    password = os.environ.get("SEED_USER_PASSWORD")

    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
        return

    # Security check: Refuse to run against production Supabase projects
    is_local = "localhost" in url or "127.0.0.1" in url
    if not is_local:
        print(f"REFUSED: SUPABASE_URL ({url}) does not look like localhost.")
        print("This script is for local development only.")
        return

    if not password:
        print("Error: SEED_USER_PASSWORD environment variable not set.")
        print("Set it in .env to specify the password for the seeded user.")
        return

    supabase: Client = create_client(url, key)

    uuid = "bc5bc231-9f20-42cf-9bfa-bca4f5dfcd36"
    email = "admin@pokecomp.app"

    try:
        # Check if user with UUID already exists
        user = supabase.auth.admin.get_user_by_id(uuid)
        print(f"User already exists: {user.user.email} (ID: {user.user.id})")
        print("Updating password from SEED_USER_PASSWORD...")
        supabase.auth.admin.update_user_by_id(uuid, {"password": password})
        print("Password updated.")
    except Exception:
        print("User does not exist, creating...")
        try:
            res = supabase.auth.admin.create_user(
                {
                    "id": uuid,
                    "email": email,
                    "password": password,
                    "email_confirm": True,
                }
            )
            print(f"Created user {res.user.email} with id {res.user.id}")
        except Exception as create_err:
            print(f"Failed to create user: {create_err}")
            return

    # Ensure profile exists and is_admin=True
    try:
        supabase.table("user_profiles").upsert(
            {"user_id": uuid, "display_name": "Admin", "is_admin": True}
        ).execute()
        print("User profile updated with is_admin=True")
    except Exception as e:
        print(f"Failed to update user profile: {e}")

    print("\nYou can log in at /login with:")
    print(f"Email: {email}")
    print("Password: [from SEED_USER_PASSWORD]")


if __name__ == "__main__":
    seed_user()
