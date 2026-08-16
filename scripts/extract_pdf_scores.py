import pdfplumber
import sys

pdf_path = r"C:\Users\JANMEJAY\Downloads\Tournament_Bracket_All_Visual_Print_4Pg (5).pdf"

with pdfplumber.open(pdf_path) as pdf:
    for i, page in enumerate(pdf.pages):
        print(f"\n===== PAGE {i+1} =====")
        text = page.extract_text()
        if text:
            print(text)
        else:
            print("[No text extracted from this page]")
