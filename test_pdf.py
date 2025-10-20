import os
import sys

# Aggiungi il percorso di Poppler al PATH di sistema per questa sessione
poppler_path = r'C:\Miniconda3\Library\bin'
os.environ['PATH'] = poppler_path + os.pathsep + os.environ.get('PATH', '')

print(f"PATH includes Poppler: {poppler_path in os.environ['PATH']}")

from pdf2image import convert_from_path

# Testa con un PDF se esiste
test_pdf = 'uploads/current.pdf'
if os.path.exists(test_pdf):
    print(f"Testing with: {test_pdf}")
    try:
        images = convert_from_path(test_pdf, dpi=300, first_page=1, last_page=1, poppler_path=poppler_path)
        print(f"Success! Converted {len(images)} page(s)")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
else:
    print(f"No test PDF found at {test_pdf}")
