import os

from dotenv import load_dotenv
from supabase import Client, create_client


def seed_user():
    # Load .env explicitly
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    load_dotenv(env_path)

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")

    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
        return

    supabase: Client = create_client(url, key)

    uuid = "bc5bc231-9f20-42cf-9bfa-bca4f5dfcd36"
    email = "commander@orbital.net"
    password = "password123"

    try:
        # Check if user with UUID already exists
        user = supabase.auth.admin.get_user_by_id(uuid)
        print(f"User already exists: {user.user.email} (ID: {user.user.id})")
        print("You can log in at /login with:")
        print(f"Email: {user.user.email}")
        print("Password: [whatever was previously set, or we can update it]")
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
            print("\nSeeded Auth user successfully!")
            print(f"Email: {email}")
            print(f"Password: {password}")
        except Exception as create_err:
            print(f"Failed to create user: {create_err}")


if __name__ == "__main__":
    seed_user()
