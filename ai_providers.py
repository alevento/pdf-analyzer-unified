"""
AI Provider abstraction layer - supports multiple AI APIs
Supported providers:
- Claude (Anthropic) - Claude Opus 4
- OpenAI - GPT-4o (unified text + vision model)
- Google Gemini 2.5 Pro
- Novita AI (Qwen 3 VL 235B - Thinking)
"""

import os
import json
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any

class AIProvider(ABC):
    """Abstract base class for AI providers"""

    def __init__(self, api_key: str):
        self.api_key = api_key

    @abstractmethod
    def analyze_text(self, prompt: str, text: str) -> str:
        """Analyze text with AI"""
        pass

    @abstractmethod
    def analyze_vision(self, prompt: str, image_base64: str) -> str:
        """Analyze image with AI vision"""
        pass

    @abstractmethod
    def chat(self, messages: list) -> str:
        """General chat/completion"""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Check if provider is configured and available"""
        pass

    @abstractmethod
    def get_name(self) -> str:
        """Get provider display name"""
        pass

    @abstractmethod
    def get_capabilities(self) -> Dict[str, bool]:
        """Get provider capabilities"""
        pass


class ClaudeProvider(AIProvider):
    """Claude (Anthropic) provider"""

    def __init__(self, api_key: str):
        super().__init__(api_key)
        self.client = None
        if api_key:
            try:
                from anthropic import Anthropic
                self.client = Anthropic(api_key=api_key)
            except ImportError:
                print("Warning: anthropic package not installed")

    def analyze_text(self, prompt: str, text: str) -> str:
        if not self.client:
            raise Exception("Claude client not initialized")

        message = self.client.messages.create(
            model="claude-opus-4-20250514",
            max_tokens=4096,
            messages=[{
                "role": "user",
                "content": f"{prompt}\n\n{text}"
            }]
        )
        return message.content[0].text

    def analyze_vision(self, prompt: str, image_base64: str) -> str:
        if not self.client:
            raise Exception("Claude client not initialized")

        # Remove data URL prefix if present
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]

        message = self.client.messages.create(
            model="claude-opus-4-20250514",
            max_tokens=4096,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": image_base64
                        }
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }]
        )
        return message.content[0].text

    def chat(self, messages: list) -> str:
        if not self.client:
            raise Exception("Claude client not initialized")

        message = self.client.messages.create(
            model="claude-opus-4-20250514",
            max_tokens=4096,
            messages=messages
        )
        return message.content[0].text

    def is_available(self) -> bool:
        return self.client is not None

    def get_name(self) -> str:
        return "Claude Opus 4"

    def get_capabilities(self) -> Dict[str, bool]:
        return {
            "text_analysis": True,
            "vision_analysis": True,
            "chat": True,
            "dimension_extraction": True
        }


class OpenAIProvider(AIProvider):
    """OpenAI (GPT-4o) provider"""

    def __init__(self, api_key: str):
        super().__init__(api_key)
        self.client = None
        if api_key:
            try:
                from openai import OpenAI
                self.client = OpenAI(api_key=api_key)
            except ImportError:
                print("Warning: openai package not installed")

    def analyze_text(self, prompt: str, text: str) -> str:
        if not self.client:
            raise Exception("OpenAI client not initialized")

        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a helpful AI assistant analyzing PDF documents."},
                {"role": "user", "content": f"{prompt}\n\n{text}"}
            ],
            max_tokens=4096
        )
        return response.choices[0].message.content

    def analyze_vision(self, prompt: str, image_base64: str) -> str:
        if not self.client:
            raise Exception("OpenAI client not initialized")

        # Ensure proper data URL format
        if not image_base64.startswith('data:'):
            image_base64 = f"data:image/png;base64,{image_base64}"

        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": image_base64}
                    }
                ]
            }],
            max_tokens=4096
        )
        return response.choices[0].message.content

    def chat(self, messages: list) -> str:
        if not self.client:
            raise Exception("OpenAI client not initialized")

        # Convert messages format if needed
        formatted_messages = []
        for msg in messages:
            if isinstance(msg, dict) and 'role' in msg and 'content' in msg:
                formatted_messages.append(msg)

        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=formatted_messages,
            max_tokens=4096
        )
        return response.choices[0].message.content

    def is_available(self) -> bool:
        return self.client is not None

    def get_name(self) -> str:
        return "GPT-4o"

    def get_capabilities(self) -> Dict[str, bool]:
        return {
            "text_analysis": True,
            "vision_analysis": True,
            "chat": True,
            "dimension_extraction": True
        }


class GeminiProvider(AIProvider):
    """Google Gemini provider"""

    def __init__(self, api_key: str):
        super().__init__(api_key)
        self.client = None
        if api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                self.client = genai.GenerativeModel('gemini-2.5-pro')
            except ImportError:
                print("Warning: google-generativeai package not installed")

    def analyze_text(self, prompt: str, text: str) -> str:
        if not self.client:
            raise Exception("Gemini client not initialized")

        response = self.client.generate_content(f"{prompt}\n\n{text}")
        return response.text

    def analyze_vision(self, prompt: str, image_base64: str) -> str:
        if not self.client:
            raise Exception("Gemini client not initialized")

        import base64
        from PIL import Image
        import io

        # Remove data URL prefix if present
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]

        # Convert base64 to PIL Image
        image_data = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_data))

        response = self.client.generate_content([prompt, image])
        return response.text

    def chat(self, messages: list) -> str:
        if not self.client:
            raise Exception("Gemini client not initialized")

        # Convert messages to Gemini format
        chat_text = ""
        for msg in messages:
            if isinstance(msg, dict):
                role = msg.get('role', 'user')
                content = msg.get('content', '')
                if isinstance(content, str):
                    chat_text += f"{role}: {content}\n\n"

        response = self.client.generate_content(chat_text)
        return response.text

    def is_available(self) -> bool:
        return self.client is not None

    def get_name(self) -> str:
        return "Gemini 2.5 Pro"

    def get_capabilities(self) -> Dict[str, bool]:
        return {
            "text_analysis": True,
            "vision_analysis": True,
            "chat": True,
            "dimension_extraction": True
        }


class NovitaAIProvider(AIProvider):
    """Novita AI provider (Qwen 3 VL 235B and other models)"""

    def __init__(self, api_key: str):
        super().__init__(api_key)
        self.client = None
        self.base_url = "https://api.novita.ai/openai"
        if api_key:
            try:
                from openai import OpenAI
                self.client = OpenAI(
                    api_key=api_key,
                    base_url=self.base_url
                )
            except ImportError:
                print("Warning: openai package not installed")

    def analyze_text(self, prompt: str, text: str) -> str:
        if not self.client:
            raise Exception("Novita AI client not initialized")

        response = self.client.chat.completions.create(
            model="qwen/qwen3-vl-235b-a22b-thinking",
            messages=[
                {"role": "system", "content": "You are a helpful AI assistant analyzing PDF documents."},
                {"role": "user", "content": f"{prompt}\n\n{text}"}
            ],
            max_tokens=32768,
            temperature=0.7
        )
        return response.choices[0].message.content

    def analyze_vision(self, prompt: str, image_base64: str) -> str:
        if not self.client:
            raise Exception("Novita AI client not initialized")

        # Ensure proper data URL format
        if not image_base64.startswith('data:'):
            image_base64 = f"data:image/png;base64,{image_base64}"

        response = self.client.chat.completions.create(
            model="qwen/qwen3-vl-235b-a22b-thinking",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": image_base64}
                    }
                ]
            }],
            max_tokens=32768,
            temperature=0.7
        )
        return response.choices[0].message.content

    def chat(self, messages: list) -> str:
        if not self.client:
            raise Exception("Novita AI client not initialized")

        # Convert messages format if needed
        formatted_messages = []
        for msg in messages:
            if isinstance(msg, dict) and 'role' in msg and 'content' in msg:
                formatted_messages.append(msg)

        response = self.client.chat.completions.create(
            model="qwen/qwen3-vl-235b-a22b-thinking",
            messages=formatted_messages,
            max_tokens=32768,
            temperature=0.7
        )
        return response.choices[0].message.content

    def is_available(self) -> bool:
        return self.client is not None

    def get_name(self) -> str:
        return "Qwen 3 VL 235B (Novita AI)"

    def get_capabilities(self) -> Dict[str, bool]:
        return {
            "text_analysis": True,
            "vision_analysis": True,
            "chat": True,
            "dimension_extraction": True
        }


class AIProviderManager:
    """Manages multiple AI providers and allows switching between them"""

    def __init__(self):
        self.providers: Dict[str, AIProvider] = {}
        self.current_provider: Optional[str] = None
        self._initialize_providers()

    def _initialize_providers(self):
        """Initialize all available providers from environment variables"""
        from dotenv import load_dotenv
        load_dotenv()

        # Claude
        anthropic_key = os.environ.get('ANTHROPIC_API_KEY', '')
        if anthropic_key:
            self.providers['claude'] = ClaudeProvider(anthropic_key)
            if self.current_provider is None:
                self.current_provider = 'claude'

        # OpenAI
        openai_key = os.environ.get('OPENAI_API_KEY', '')
        if openai_key:
            self.providers['openai'] = OpenAIProvider(openai_key)
            if self.current_provider is None:
                self.current_provider = 'openai'

        # Gemini
        gemini_key = os.environ.get('GEMINI_API_KEY', '')
        if gemini_key:
            self.providers['gemini'] = GeminiProvider(gemini_key)
            if self.current_provider is None:
                self.current_provider = 'gemini'

        # Novita AI
        novita_key = os.environ.get('NOVITA_API_KEY', '')
        if novita_key:
            self.providers['novita'] = NovitaAIProvider(novita_key)
            if self.current_provider is None:
                self.current_provider = 'novita'

    def get_available_providers(self) -> Dict[str, str]:
        """Get list of available providers"""
        available = {}
        for key, provider in self.providers.items():
            if provider.is_available():
                available[key] = provider.get_name()
        return available

    def set_provider(self, provider_key: str) -> bool:
        """Set the current provider"""
        if provider_key in self.providers and self.providers[provider_key].is_available():
            self.current_provider = provider_key
            return True
        return False

    def get_current_provider(self) -> Optional[AIProvider]:
        """Get the current active provider"""
        if self.current_provider and self.current_provider in self.providers:
            return self.providers[self.current_provider]
        return None

    def get_current_provider_name(self) -> str:
        """Get the name of current provider"""
        provider = self.get_current_provider()
        if provider:
            return provider.get_name()
        return "None"

    def is_any_available(self) -> bool:
        """Check if any provider is available"""
        return len(self.get_available_providers()) > 0

    def get_current_capabilities(self) -> Dict[str, bool]:
        """Get capabilities of current provider"""
        provider = self.get_current_provider()
        if provider:
            return provider.get_capabilities()
        return {
            "text_analysis": False,
            "vision_analysis": False,
            "chat": False,
            "dimension_extraction": False
        }
