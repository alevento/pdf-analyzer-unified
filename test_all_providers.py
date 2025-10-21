"""
Test script for all AI provider API keys
"""
import os
import sys
from dotenv import load_dotenv
from ai_providers import ClaudeProvider, OpenAIProvider, GeminiProvider, NovitaAIProvider

# Set UTF-8 encoding for console output
sys.stdout.reconfigure(encoding='utf-8') if hasattr(sys.stdout, 'reconfigure') else None

# Load environment variables
load_dotenv()

def test_provider(provider_name, provider_class, api_key_name):
    """Test a single AI provider"""
    print("=" * 60)
    print(f"{provider_name.upper()} API KEY TEST")
    print("=" * 60)

    # Get API key
    api_key = os.environ.get(api_key_name, '')

    if not api_key:
        print(f"[SKIP] {api_key_name} non trovata nel file .env")
        print()
        return None

    print(f"[OK] API Key trovata: {api_key[:20]}...")
    print()

    # Initialize provider
    print(f"Inizializzazione {provider_name}...")
    try:
        provider = provider_class(api_key)

        if not provider.is_available():
            print("[ERROR] Provider non disponibile (possibile errore di installazione)")
            print()
            return False

        print(f"[OK] Provider inizializzato: {provider.get_name()}")
        print()

    except Exception as e:
        print(f"[ERROR] durante inizializzazione: {e}")
        print()
        return False

    # Test 1: Simple text analysis
    print("TEST 1: Analisi testo semplice")
    print("-" * 60)
    try:
        response = provider.analyze_text(
            prompt="Answer with just one word: what is the capital of Italy?",
            text=""
        )
        print(f"[OK] Risposta ricevuta: {response[:100]}...")
        print()
    except Exception as e:
        print(f"[ERROR] {e}")
        print()
        return False

    # Test 2: Chat completion
    print("TEST 2: Chat completion")
    print("-" * 60)
    try:
        response = provider.chat([
            {"role": "user", "content": "Tell me an interesting fact about the moon in one sentence"}
        ])
        print(f"[OK] Risposta ricevuta: {response[:100]}...")
        print()
    except Exception as e:
        print(f"[ERROR] {e}")
        print()
        return False

    print("[SUCCESS] TUTTI I TEST SUPERATI!")
    print(f"[SUCCESS] La tua API key {provider_name} funziona correttamente")
    print()
    return True


def main():
    print("\n")
    print("#" * 60)
    print("# TEST DI TUTTE LE API KEY CONFIGURATE")
    print("#" * 60)
    print("\n")

    results = {}

    # Test Claude
    results['Claude'] = test_provider(
        "Claude",
        ClaudeProvider,
        "ANTHROPIC_API_KEY"
    )

    # Test OpenAI
    results['OpenAI'] = test_provider(
        "OpenAI",
        OpenAIProvider,
        "OPENAI_API_KEY"
    )

    # Test Gemini
    results['Gemini'] = test_provider(
        "Gemini",
        GeminiProvider,
        "GEMINI_API_KEY"
    )

    # Test Novita AI
    results['Novita AI'] = test_provider(
        "Novita AI",
        NovitaAIProvider,
        "NOVITA_API_KEY"
    )

    # Summary
    print("\n")
    print("#" * 60)
    print("# RIEPILOGO RISULTATI")
    print("#" * 60)
    print()

    for provider, result in results.items():
        if result is None:
            status = "[SKIP] Non configurato"
        elif result:
            status = "[OK] Funzionante"
        else:
            status = "[ERROR] Fallito"

        print(f"{provider:15} : {status}")

    print()
    print("#" * 60)

    # Return exit code
    if any(result is False for result in results.values()):
        return 1
    return 0


if __name__ == "__main__":
    try:
        exit_code = main()
        exit(exit_code)
    except Exception as e:
        print(f"\n[FATAL ERROR] {e}")
        import traceback
        traceback.print_exc()
        exit(1)
