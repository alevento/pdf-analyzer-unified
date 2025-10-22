#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test script per Qwen 3 VL 235B Vision API via Novita.ai
Verifica che l'integrazione funzioni correttamente
"""

import os
from dotenv import load_dotenv
from ai_providers import NovitaAIProvider

def test_qwen_text_analysis():
    """Test analisi testo con Qwen 3 VL"""
    print("\n" + "="*60)
    print("TEST 1: Analisi Testo con Qwen 3 VL 235B")
    print("="*60)

    load_dotenv()
    api_key = os.environ.get('NOVITA_API_KEY', '')

    if not api_key:
        print("[FAIL] NOVITA_API_KEY non configurata in .env")
        return False

    try:
        provider = NovitaAIProvider(api_key)

        if not provider.is_available():
            print("[FAIL] Provider non disponibile")
            return False

        print(f"[OK] Provider inizializzato: {provider.get_name()}")
        print(f"   Base URL: {provider.base_url}")
        print(f"   Model: qwen/qwen3-vl-235b-a22b-thinking")

        # Test semplice analisi testo
        prompt = "Analizza questo testo e dimmi di cosa parla in una frase."
        text = "Il modello Qwen 3 VL è un modello di linguaggio multimodale che supporta testo, immagini e video."

        print(f"\n Prompt: {prompt}")
        print(f" Testo: {text}")
        print("\n... Invio richiesta...")

        result = provider.analyze_text(prompt, text)

        print(f"\n[OK] Risposta ricevuta:")
        print(f"   {result[:200]}..." if len(result) > 200 else f"   {result}")

        return True

    except Exception as e:
        print(f"\n[FAIL] Errore: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def test_qwen_vision_analysis():
    """Test analisi visione con Qwen 3 VL"""
    print("\n" + "="*60)
    print("TEST 2: Analisi Vision con Qwen 3 VL 235B")
    print("="*60)

    load_dotenv()
    api_key = os.environ.get('NOVITA_API_KEY', '')

    if not api_key:
        print("[FAIL] NOVITA_API_KEY non configurata in .env")
        return False

    try:
        provider = NovitaAIProvider(api_key)

        # Crea un'immagine di test semplice (1x1 pixel rosso in base64)
        # Questo è solo per testare che l'API accetti le richieste
        test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="

        prompt = "Descrivi cosa vedi in questa immagine in poche parole."

        print(f"\n Prompt: {prompt}")
        print(f"  Immagine: [test image 1x1 pixel]")
        print("\n... Invio richiesta Vision API...")

        result = provider.analyze_vision(prompt, test_image_base64)

        print(f"\n[OK] Risposta ricevuta:")
        print(f"   {result[:200]}..." if len(result) > 200 else f"   {result}")

        return True

    except Exception as e:
        print(f"\n[FAIL] Errore: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def test_qwen_capabilities():
    """Test capabilities del provider"""
    print("\n" + "="*60)
    print("TEST 3: Capabilities Qwen 3 VL 235B")
    print("="*60)

    load_dotenv()
    api_key = os.environ.get('NOVITA_API_KEY', '')

    if not api_key:
        print("[FAIL] NOVITA_API_KEY non configurata in .env")
        return False

    try:
        provider = NovitaAIProvider(api_key)
        capabilities = provider.get_capabilities()

        print("\n[OK] Capabilities:")
        for key, value in capabilities.items():
            status = "[OK]" if value else "[FAIL]"
            print(f"   {status} {key}: {value}")

        return True

    except Exception as e:
        print(f"\n[FAIL] Errore: {str(e)}")
        return False


def main():
    """Esegue tutti i test"""
    print("\n" + "="*60)
    print("QWEN 3 VL 235B (NOVITA AI) - TEST SUITE")
    print("="*60)

    results = {
        "Text Analysis": test_qwen_text_analysis(),
        "Vision Analysis": test_qwen_vision_analysis(),
        "Capabilities": test_qwen_capabilities()
    }

    print("\n" + "="*60)
    print("RIEPILOGO RISULTATI")
    print("="*60)

    for test_name, result in results.items():
        status = "[OK] PASS" if result else "[FAIL] FAIL"
        print(f"{status}: {test_name}")

    all_passed = all(results.values())

    if all_passed:
        print("\n[SUCCESS] Tutti i test sono passati!")
        print("   Integrazione Qwen 3 VL 235B funzionante correttamente.")
    else:
        print("\n[WARNING]  Alcuni test sono falliti.")
        print("   Verificare configurazione API key e connessione.")

    return all_passed


if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)
