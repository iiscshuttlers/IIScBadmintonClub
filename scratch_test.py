import asyncio
from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv('client/.env')

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_ANON_KEY")

supabase: Client = create_client(url, key)

response = supabase.table("matches").select("*").limit(1).execute()
print(response)
