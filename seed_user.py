import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv("api/.env")

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")

if not url or not key:
    print("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
    exit(1)

supabase: Client = create_client(url, key)

uuid = "bc5bc231-9f20-42cf-9bfa-bca4f5dfcd36"
email = "commander@orbital.net"
password = "password123"

# check if user exists
try:
    user = supabase.auth.admin.get_user_by_id(uuid)
    print(f"User already exists: {user.user.email}")
except Exception as e:
    print("User does not exist, creating...")
    res = supabase.auth.admin.create_user({
        "id": uuid,
        "email": email,
        "password": password,
        "email_confirm": True
    })
    print(f"Created user {res.user.email} with id {res.user.id}")

