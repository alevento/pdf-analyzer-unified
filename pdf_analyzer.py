import sys
import os
from pathlib import Path
import pdfplumber
import fitz  # PyMuPDF
from pdf2image import convert_from_path
import pytesseract
from PIL import Image
import io
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout,
                              QHBoxLayout, QPushButton, QFileDialog, QLabel,
                              QTextEdit, QSplitter, QComboBox, QSpinBox,
                              QGroupBox, QScrollArea)
from PyQt6.QtCore import Qt, QThread, pyqtSignal
from PyQt6.QtGui import QPixmap, QImage
import numpy as np

# Configure Tesseract path for Windows
if os.name == 'nt':  # Windows
    tesseract_path = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
    if os.path.exists(tesseract_path):
        pytesseract.pytesseract.tesseract_cmd = tesseract_path


class PDFProcessor:
    """Handles PDF analysis and text extraction with intelligent type detection"""

    def __init__(self, pdf_path):
        self.pdf_path = pdf_path
        self.pdf_type = None
        self.pages_info = []

    def detect_pdf_type(self):
        """
        Detect if PDF is textual, rasterized (image-based), or hybrid
        Returns: 'textual', 'rasterized', or 'hybrid'
        """
        doc = fitz.open(self.pdf_path)
        text_pages = 0
        image_pages = 0

        for page_num in range(min(5, len(doc))):  # Sample first 5 pages
            page = doc[page_num]
            text = page.get_text().strip()
            images = page.get_images()

            page_info = {
                'page_num': page_num,
                'has_text': len(text) > 100,  # Substantial text
                'has_images': len(images) > 0,
                'text_length': len(text),
                'image_count': len(images)
            }

            if page_info['has_text']:
                text_pages += 1
            if page_info['has_images'] and not page_info['has_text']:
                image_pages += 1

            self.pages_info.append(page_info)

        doc.close()

        total_checked = len(self.pages_info)

        if text_pages == total_checked:
            self.pdf_type = 'textual'
        elif image_pages == total_checked:
            self.pdf_type = 'rasterized'
        else:
            self.pdf_type = 'hybrid'

        return self.pdf_type, self.pages_info

    def extract_with_pdfplumber(self, page_num=0, rotation=0, region=None):
        """
        Extract text with coordinates using pdfplumber

        Args:
            page_num: Page number to extract (0-indexed)
            rotation: Rotation angle (0, 90, 180, 270)
            region: Tuple (x0, y0, x1, y1) for region filtering

        Returns:
            List of dicts with 'text', 'x0', 'y0', 'x1', 'y1', 'width', 'height'
        """
        extracted_data = []

        with pdfplumber.open(self.pdf_path) as pdf:
            if page_num >= len(pdf.pages):
                return extracted_data

            page = pdf.pages[page_num]

            # Apply region filtering if specified
            if region:
                page = page.crop(region)

            # Handle rotation
            if rotation != 0:
                # pdfplumber doesn't have built-in rotation,
                # we'll need to adjust coordinates after extraction
                pass

            # Extract words with coordinates
            words = page.extract_words(
                x_tolerance=3,
                y_tolerance=3,
                keep_blank_chars=False,
                use_text_flow=True
            )

            for word in words:
                extracted_data.append({
                    'text': word['text'],
                    'x0': word['x0'],
                    'y0': word['top'],
                    'x1': word['x1'],
                    'y1': word['bottom'],
                    'width': word['x1'] - word['x0'],
                    'height': word['bottom'] - word['top']
                })

        return extracted_data

    def get_full_text_pdfplumber(self):
        """Extract all text from all pages using pdfplumber"""
        full_text = []

        with pdfplumber.open(self.pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages):
                text = page.extract_text()
                if text:
                    full_text.append(f"--- Page {page_num + 1} ---\n{text}\n")

        return "\n".join(full_text)

    def extract_with_ocr(self, page_num=0, psm_mode=6, rotation=0):
        """
        Extract text using Tesseract OCR with advanced PSM modes

        Args:
            page_num: Page number to extract (0-indexed)
            psm_mode: Tesseract PSM mode (6=uniform block, 12=sparse text+OSD)
            rotation: Additional rotation to apply

        Returns:
            Tuple of (extracted_text, confidence_data)
        """
        # Convert PDF page to image
        images = convert_from_path(
            self.pdf_path,
            first_page=page_num + 1,
            last_page=page_num + 1,
            dpi=300
        )

        if not images:
            return "", []

        image = images[0]

        # Apply rotation if needed
        if rotation != 0:
            image = image.rotate(-rotation, expand=True)

        # Configure Tesseract
        custom_config = f'--psm {psm_mode} --oem 3'

        # Extract text
        text = pytesseract.image_to_string(image, config=custom_config, lang='ita+eng')

        # Get detailed data with coordinates
        data = pytesseract.image_to_data(
            image,
            config=custom_config,
            lang='ita+eng',
            output_type=pytesseract.Output.DICT
        )

        return text, data

    def should_use_ocr(self, page_num=0):
        """
        Determine if OCR should be used for a specific page
        Checks if text is rotated or if pdfplumber extraction is poor
        """
        with pdfplumber.open(self.pdf_path) as pdf:
            if page_num >= len(pdf.pages):
                return True

            page = pdf.pages[page_num]
            text = page.extract_text()

            # If very little text extracted, use OCR
            if not text or len(text.strip()) < 50:
                return True

            # Check for rotated text by analyzing character positions
            words = page.extract_words()
            if not words:
                return True

            # Simple heuristic: if many words have unusual aspect ratios, text might be rotated
            unusual_ratio_count = 0
            for word in words[:20]:  # Check first 20 words
                width = word['x1'] - word['x0']
                height = word['bottom'] - word['top']
                if height > 0:
                    ratio = width / height
                    # Normal text has ratio > 1, rotated text might have ratio < 1
                    if ratio < 0.5:
                        unusual_ratio_count += 1

            if unusual_ratio_count > 10:  # More than half of sampled words
                return True

        return False


class ProcessingThread(QThread):
    """Background thread for PDF processing"""
    finished = pyqtSignal(str, dict)
    progress = pyqtSignal(str)

    def __init__(self, pdf_path):
        super().__init__()
        self.pdf_path = pdf_path

    def run(self):
        try:
            self.progress.emit("Analyzing PDF type...")
            processor = PDFProcessor(self.pdf_path)
            pdf_type, pages_info = processor.detect_pdf_type()

            self.progress.emit(f"PDF Type detected: {pdf_type}")

            results = {
                'pdf_type': pdf_type,
                'pages_info': pages_info,
                'processor': processor
            }

            # Extract full text
            if pdf_type in ['textual', 'hybrid']:
                self.progress.emit("Extracting text with pdfplumber...")
                full_text = processor.get_full_text_pdfplumber()
                results['full_text'] = full_text
            else:
                self.progress.emit("Extracting text with OCR...")
                # For rasterized PDFs, use OCR
                all_text = []
                for i in range(min(5, len(pages_info))):
                    text, _ = processor.extract_with_ocr(page_num=i, psm_mode=6)
                    all_text.append(f"--- Page {i + 1} ---\n{text}\n")
                results['full_text'] = "\n".join(all_text)

            self.finished.emit("Processing complete", results)

        except Exception as e:
            self.finished.emit(f"Error: {str(e)}", {})


class PDFAnalyzerUI(QMainWindow):
    """Main application window with dual-panel interface"""

    def __init__(self):
        super().__init__()
        self.pdf_path = None
        self.processor = None
        self.current_page = 0

        self.init_ui()

    def init_ui(self):
        self.setWindowTitle("PDF Analyzer - Intelligent Text Extraction")
        self.setGeometry(100, 100, 1400, 800)

        # Main widget and layout
        main_widget = QWidget()
        self.setCentralWidget(main_widget)
        layout = QVBoxLayout(main_widget)

        # Top controls
        controls_layout = QHBoxLayout()

        self.load_btn = QPushButton("Load PDF")
        self.load_btn.clicked.connect(self.load_pdf)
        controls_layout.addWidget(self.load_btn)

        self.pdf_type_label = QLabel("PDF Type: Not loaded")
        controls_layout.addWidget(self.pdf_type_label)

        controls_layout.addStretch()

        layout.addLayout(controls_layout)

        # Main splitter for dual panels
        splitter = QSplitter(Qt.Orientation.Horizontal)

        # Left panel: PDF viewer and extraction controls
        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)

        # PDF viewer
        self.pdf_viewer = QLabel("Load a PDF to begin")
        self.pdf_viewer.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.pdf_viewer.setStyleSheet("border: 1px solid #ccc; background: #f5f5f5;")
        self.pdf_viewer.setMinimumSize(600, 700)

        scroll_area = QScrollArea()
        scroll_area.setWidget(self.pdf_viewer)
        scroll_area.setWidgetResizable(True)
        left_layout.addWidget(scroll_area)

        # Extraction controls
        controls_group = QGroupBox("Extraction Controls")
        controls_group_layout = QVBoxLayout()

        page_layout = QHBoxLayout()
        page_layout.addWidget(QLabel("Page:"))
        self.page_spinbox = QSpinBox()
        self.page_spinbox.setMinimum(1)
        self.page_spinbox.valueChanged.connect(self.change_page)
        page_layout.addWidget(self.page_spinbox)
        controls_group_layout.addLayout(page_layout)

        rotation_layout = QHBoxLayout()
        rotation_layout.addWidget(QLabel("Rotation:"))
        self.rotation_combo = QComboBox()
        self.rotation_combo.addItems(["0°", "90°", "180°", "270°"])
        rotation_layout.addWidget(self.rotation_combo)
        controls_group_layout.addLayout(rotation_layout)

        psm_layout = QHBoxLayout()
        psm_layout.addWidget(QLabel("OCR PSM Mode:"))
        self.psm_combo = QComboBox()
        self.psm_combo.addItems(["6 - Uniform block", "12 - Sparse text + OSD"])
        psm_layout.addWidget(self.psm_combo)
        controls_group_layout.addLayout(psm_layout)

        extract_btn_layout = QHBoxLayout()
        self.extract_pdfplumber_btn = QPushButton("Extract with pdfplumber")
        self.extract_pdfplumber_btn.clicked.connect(self.extract_with_pdfplumber)
        extract_btn_layout.addWidget(self.extract_pdfplumber_btn)

        self.extract_ocr_btn = QPushButton("Extract with OCR")
        self.extract_ocr_btn.clicked.connect(self.extract_with_ocr)
        extract_btn_layout.addWidget(self.extract_ocr_btn)
        controls_group_layout.addLayout(extract_btn_layout)

        controls_group.setLayout(controls_group_layout)
        left_layout.addWidget(controls_group)

        splitter.addWidget(left_panel)

        # Right panel: Extracted text display
        right_panel = QWidget()
        right_layout = QVBoxLayout(right_panel)

        right_layout.addWidget(QLabel("Extracted Text:"))

        self.text_display = QTextEdit()
        self.text_display.setReadOnly(True)
        self.text_display.setStyleSheet("font-family: 'Courier New'; font-size: 10pt;")
        right_layout.addWidget(self.text_display)

        splitter.addWidget(right_panel)

        # Set splitter proportions
        splitter.setSizes([700, 700])

        layout.addWidget(splitter)

        # Status bar
        self.statusBar().showMessage("Ready")

    def load_pdf(self):
        """Load PDF file and analyze it"""
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "Select PDF File",
            "",
            "PDF Files (*.pdf)"
        )

        if file_path:
            self.pdf_path = file_path
            self.statusBar().showMessage(f"Loading: {Path(file_path).name}")

            # Start processing in background
            self.processing_thread = ProcessingThread(file_path)
            self.processing_thread.progress.connect(self.update_status)
            self.processing_thread.finished.connect(self.processing_finished)
            self.processing_thread.start()

    def update_status(self, message):
        """Update status bar"""
        self.statusBar().showMessage(message)

    def processing_finished(self, message, results):
        """Handle processing completion"""
        self.statusBar().showMessage(message)

        if results:
            self.processor = results.get('processor')
            pdf_type = results.get('pdf_type')
            self.pdf_type_label.setText(f"PDF Type: {pdf_type.upper()}")

            # Display extracted text
            full_text = results.get('full_text', '')
            self.text_display.setPlainText(full_text)

            # Update page controls
            with pdfplumber.open(self.pdf_path) as pdf:
                self.page_spinbox.setMaximum(len(pdf.pages))

            # Display first page
            self.display_page(0)

    def display_page(self, page_num):
        """Display PDF page as image"""
        try:
            images = convert_from_path(
                self.pdf_path,
                first_page=page_num + 1,
                last_page=page_num + 1,
                dpi=150
            )

            if images:
                # Convert PIL image to QPixmap
                img = images[0]
                img_byte_arr = io.BytesIO()
                img.save(img_byte_arr, format='PNG')
                img_byte_arr.seek(0)

                qimage = QImage()
                qimage.loadFromData(img_byte_arr.read())
                pixmap = QPixmap.fromImage(qimage)

                # Scale to fit
                scaled_pixmap = pixmap.scaled(
                    self.pdf_viewer.width() - 20,
                    self.pdf_viewer.height() - 20,
                    Qt.AspectRatioMode.KeepAspectRatio,
                    Qt.TransformationMode.SmoothTransformation
                )

                self.pdf_viewer.setPixmap(scaled_pixmap)
        except Exception as e:
            self.statusBar().showMessage(f"Error displaying page: {str(e)}")

    def change_page(self, page_num):
        """Handle page change"""
        self.current_page = page_num - 1
        self.display_page(self.current_page)

    def extract_with_pdfplumber(self):
        """Extract text using pdfplumber with current settings"""
        if not self.processor:
            return

        rotation = int(self.rotation_combo.currentText().replace("°", ""))

        try:
            self.statusBar().showMessage("Extracting with pdfplumber...")
            data = self.processor.extract_with_pdfplumber(
                page_num=self.current_page,
                rotation=rotation
            )

            # Format output
            output = f"=== Page {self.current_page + 1} - pdfplumber extraction ===\n\n"

            for item in data:
                output += f"Text: '{item['text']}'\n"
                output += f"  Position: ({item['x0']:.2f}, {item['y0']:.2f}) -> ({item['x1']:.2f}, {item['y1']:.2f})\n"
                output += f"  Size: {item['width']:.2f} x {item['height']:.2f}\n\n"

            output += f"\nTotal words extracted: {len(data)}\n"

            self.text_display.setPlainText(output)
            self.statusBar().showMessage(f"Extracted {len(data)} words with pdfplumber")

        except Exception as e:
            self.statusBar().showMessage(f"Error: {str(e)}")

    def extract_with_ocr(self):
        """Extract text using Tesseract OCR with current settings"""
        if not self.processor:
            return

        psm_text = self.psm_combo.currentText()
        psm_mode = 6 if "6" in psm_text else 12
        rotation = int(self.rotation_combo.currentText().replace("°", ""))

        try:
            self.statusBar().showMessage(f"Extracting with OCR (PSM {psm_mode})...")
            text, data = self.processor.extract_with_ocr(
                page_num=self.current_page,
                psm_mode=psm_mode,
                rotation=rotation
            )

            # Format output
            output = f"=== Page {self.current_page + 1} - OCR extraction (PSM {psm_mode}) ===\n\n"
            output += text
            output += "\n\n--- Detailed word data ---\n\n"

            # Show confidence data
            for i, word in enumerate(data['text']):
                if word.strip():
                    conf = data['conf'][i]
                    left = data['left'][i]
                    top = data['top'][i]
                    width = data['width'][i]
                    height = data['height'][i]
                    output += f"'{word}' - Confidence: {conf}% at ({left}, {top}), size: {width}x{height}\n"

            self.text_display.setPlainText(output)
            self.statusBar().showMessage(f"OCR extraction complete (PSM {psm_mode})")

        except Exception as e:
            self.statusBar().showMessage(f"Error: {str(e)}")


def main():
    app = QApplication(sys.argv)
    window = PDFAnalyzerUI()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
