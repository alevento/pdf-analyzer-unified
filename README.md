# PDF Analyzer Unified v0.23

## Latest Updates (v0.23)
- **Dimension Integration with Templates**: Automatically populate dimension fields in Excel templates using dimension extraction prompts
- **Optional Dimension Extraction**: Select a dimension prompt in the template section to extract and include dimensions in the output
- **AI-Powered Dimension Mapping**: Claude Opus intelligently maps extracted dimensions to the appropriate fields in your template
- **Seamless Workflow**: Dimension extraction happens automatically during template generation with real-time progress feedback

## Previous Updates (v0.22)
- **Dimension Extraction Prompts**: Save, manage, and reuse custom prompts for extracting dimensions from technical drawings
- **Drawing-Specific Extraction**: Create specialized prompts for different types of technical drawings (mechanical, electrical, architectural, etc.)
- **Prompt Library Management**: Save, load, delete, and download dimension extraction prompts with names
- **File Upload for Prompts**: Import dimension prompts from .txt files with automatic name filling
- **Download Prompts and Templates**: Download saved prompts and templates as .txt files for backup or sharing
- **Direct AI Vision Integration**: Extract dimensions directly from PDF pages using Claude Opus Vision with custom prompts
- **Same Interface as Templates**: Familiar workflow for managing dimension prompts, similar to template management

## Previous Updates (v0.21)
- **Token Limit Protection**: Automatic data reduction to prevent Claude Opus 200k token limit errors
- **Smart Data Deduplication**: OCR numbers are grouped by unique values (max 500 unique items)
- **Text Truncation**: PDFplumber text limited to 100,000 characters (~25,000 tokens) with clear truncation notice
- **Large PDF Support**: Now handles PDFs with many pages without exceeding API limits
- **Optimized Data Transfer**: Only essential data sent to Claude for template generation

## Previous Updates (v0.20)
- **Selective Extraction Methods**: Choose which extraction methods to use for template generation via checkboxes
- **Customizable Analysis**: Select any combination of PDFplumber, OCR, AI Analysis, AI Summary, and AI Vision
- **Dynamic Progress Calculation**: Progress bar and time estimation adapt based on selected methods
- **Persistent Preferences**: Extraction method selections are saved and restored automatically using browser localStorage
- **Faster Processing**: Skip unnecessary extraction methods to speed up analysis

## Previous Updates (v0.19)
- **Automatic Complete PDF Analysis**: When generating from template, the system automatically analyzes the entire PDF using all available methods
- **Comprehensive Data Extraction**: Processes all pages with pdfplumber, advanced OCR (0° and 90° rotation), AI analysis, AI summary, and vision analysis
- **Real-time Progress Tracking**: Visual progress bar showing current step and completion percentage
- **Smart Time Estimation**: Calculates and displays estimated time remaining during analysis
- **Sequential Processing**: Page-by-page processing with detailed progress feedback

## Previous Updates (v0.18)
- **Template Library Management**: Save, name, and organize your templates for reuse
- Load templates from a dropdown menu for quick access
- Delete unwanted templates from the library
- Auto-fill template names from file names
- Persistent template storage across sessions

## Previous Updates (v0.17)
- Template-based Excel/CSV generation: Import a text template describing the desired output structure and generate Excel files automatically populated with extracted data
- Claude Opus AI integration for template interpretation and data mapping
- Combines data from all extraction methods (pdfplumber, OCR, AI analysis) into customizable output formats
