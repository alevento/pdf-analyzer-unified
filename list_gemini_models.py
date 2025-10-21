"""
List available Gemini models
"""
import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

gemini_key = os.environ.get('GEMINI_API_KEY', '')
if not gemini_key:
    print("GEMINI_API_KEY not found")
    exit(1)

genai.configure(api_key=gemini_key)

print("Available Gemini models:")
print("=" * 60)
for model in genai.list_models():
    if 'generateContent' in model.supported_generation_methods:
        print(f"Model: {model.name}")
        print(f"  Display name: {model.display_name}")
        print(f"  Description: {model.description}")
        print(f"  Methods: {model.supported_generation_methods}")
        print()
