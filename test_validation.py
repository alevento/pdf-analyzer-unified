"""Test validation function"""

import re

def _is_valid_technical_drawing(dimensions_text):
    """
    Check if the AI response contains valid technical drawing dimensions
    Returns False if the response indicates it's not a technical drawing
    """
    if not dimensions_text:
        return False

    # Convert to lowercase for case-insensitive matching
    text_lower = dimensions_text.lower()

    # Patterns that indicate the page is NOT a valid technical drawing
    invalid_patterns = [
        "non è un disegno tecnico",
        "non è un disegno",
        "non contiene dimensioni",
        "material data sheet",
        "scheda dati",
        "non presenta dimensioni",
        "non sono presenti dimensioni",
        "impossibile estrarre dimensioni",
        "l'immagine fornita non è",
        "il documento fornito non è",
        "il documento fornito è",
        "non posso fornire dimensioni",
        "pagina vuota",
        "copertina",
        "frontespizio",
        "indice",
        "sommario"
    ]

    # Check if any invalid pattern is present
    print(f"\n[Test] Checking text: {dimensions_text[:100]}...")
    print(f"[Test] Text length: {len(dimensions_text)}")
    print(f"[Test] Text lowercase: {text_lower[:100]}...")

    for pattern in invalid_patterns:
        if pattern in text_lower:
            print(f"[Test] MATCHED INVALID PATTERN: '{pattern}'")
            return False

    print("[Test] No invalid patterns found")

    # Additional validation: check if there are actual dimension patterns
    dimension_patterns = [
        r'\d+\s*x\s*\d+',  # 123x456 or 123 x 456
        r'\d+\s*mm',       # 123mm or 123 mm
        r'\d+\s*cm',       # 123cm or 123 cm
        r'\d+\.\d+',       # 123.45 (decimal numbers)
        r'∅\s*\d+',        # ∅123 (diameter symbol)
        r'Ø\s*\d+'         # Ø123 (alternative diameter)
    ]

    for pattern in dimension_patterns:
        if re.search(pattern, dimensions_text):
            print(f"[Test] FOUND DIMENSION PATTERN: {pattern}")
            return True

    # If no dimension patterns found and text is long (explanatory), mark as invalid
    if len(dimensions_text) > 100:
        print(f"[Test] Text is long ({len(dimensions_text)} chars) and no dimensions found -> INVALID")
        return False

    # Default to True for short responses (might be dimension values)
    print("[Test] Short text, default to VALID")
    return True


# Test cases from database
test_cases = [
    ("1230x1230x1030", True),  # Should be valid
    ("L'immagine fornita non è un disegno tecnico meccanico, ma un documento di testo (una checklist di revisione). Di conseguenza, non contiene alcuna rappresentazione grafica di un componente né le quote dimensionali richieste. È impossibile estrarre le tre massime dimensioni di ingombro (Lunghezza, Larghezza, Altezza) in quanto non sono presenti.", False),  # Should be invalid (page 24)
    ("Il documento allegato non è un disegno tecnico meccanico, ma una \"Material Data Sheet\" (scheda dati materiale). Di conseguenza, non contiene alcuna rappresentazione grafica del componente né le quote dimensionali necessarie per definirne l'ingombro totale. Pertanto, è impossibile estrarre i valori di Lunghezza, Larghezza e Altezza.", False),  # Should be invalid
]

print("=" * 80)
print("VALIDATION TESTS")
print("=" * 80)

for i, (text, expected) in enumerate(test_cases, 1):
    print(f"\n{'='*80}")
    print(f"TEST {i}: Expected={expected}")
    result = _is_valid_technical_drawing(text)
    status = "PASS" if result == expected else "FAIL"
    print(f"\nRESULT: {result} {status}")
