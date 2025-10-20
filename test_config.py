import pytesseract
from pdf2image import convert_from_path
import os

print("Testing Tesseract...")
try:
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
    version = pytesseract.get_tesseract_version()
    print(f"[OK] Tesseract version: {version}")
except Exception as e:
    print(f"[ERROR] Tesseract error: {e}")

print("\nTesting Poppler...")
try:
    poppler_path = r'C:\Miniconda3\Library\bin'
    print(f"Poppler path exists: {os.path.exists(poppler_path)}")
    print(f"pdftoppm exists: {os.path.exists(os.path.join(poppler_path, 'pdftoppm.exe'))}")
except Exception as e:
    print(f"[ERROR] Poppler error: {e}")

print("\nDone!")
