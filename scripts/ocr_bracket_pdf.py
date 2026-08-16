import base64
import json
import urllib.request
import subprocess
import sys
import os

API_KEY = "AQ.Ab8RN6IGnB4cVHv8p7s2cmnsDAnAHL115hlUWRISwd3U0a2qSQ"

PDF_PATH = r"C:\Users\JANMEJAY\Downloads\Tournament_Bracket_All_Visual_Print_4Pg (5).pdf"

# First convert PDF pages to PNG images using pdf2image (needs poppler)
# Let's try using the Gemini API with the raw PDF as base64

def encode_file_base64(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

print("Encoding PDF...")
pdf_b64 = encode_file_base64(PDF_PATH)
print(f"PDF encoded: {len(pdf_b64)} chars")

url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={API_KEY}"

payload = {
    "contents": [
        {
            "parts": [
                {
                    "inline_data": {
                        "mime_type": "application/pdf",
                        "data": pdf_b64
                    }
                },
                {
                    "text": """This is a tournament bracket PDF for Men's Doubles (MD) category.
Please extract ALL Men's Doubles Round 1 match results from this PDF.
For each completed match, provide:
- Match code (e.g. MD_R1_02)
- Team 1 name (with partner)
- Team 2 name (with partner)  
- Score (e.g. 21-15, 18-21, 21-18)
- Winner team

List ONLY completed matches that have actual scores (not BYE or TBD).
Format as: MD_R1_XX | Team1 | Team2 | Score | Winner"""
                }
            ]
        }
    ]
}

data = json.dumps(payload).encode("utf-8")
req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

print("Calling Gemini API...")
try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        text = result["candidates"][0]["content"]["parts"][0]["text"]
        print("\n=== EXTRACTED MD ROUND 1 RESULTS ===\n")
        print(text)
except Exception as e:
    print(f"Error: {e}")
    if hasattr(e, 'read'):
        print(e.read().decode())
