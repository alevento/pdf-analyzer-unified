import os
from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename
import pdfplumber
import fitz  # PyMuPDF
from pdf2image import convert_from_path
import pytesseract
from PIL import Image
import base64
import io

# Configure Tesseract and Poppler paths for Windows
if os.name == 'nt':
    tesseract_path = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
    if os.path.exists(tesseract_path):
        pytesseract.pytesseract.tesseract_cmd = tesseract_path

    # Poppler path
    POPPLER_PATH = r'C:\Miniconda3\Library\bin'

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max
ALLOWED_EXTENSIONS = {'pdf'}

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


class PDFProcessor:
    """Handles PDF analysis and text extraction"""

    def __init__(self, pdf_path):
        self.pdf_path = pdf_path
        self.pdf_type = None
        self.pages_info = []

    def detect_pdf_type(self):
        """Detect if PDF is textual, rasterized, or hybrid"""
        doc = fitz.open(self.pdf_path)
        text_pages = 0
        image_pages = 0

        for page_num in range(min(5, len(doc))):
            page = doc[page_num]
            text = page.get_text().strip()
            images = page.get_images()

            page_info = {
                'page_num': page_num,
                'has_text': len(text) > 100,
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

    def get_page_count(self):
        """Get total number of pages"""
        with pdfplumber.open(self.pdf_path) as pdf:
            return len(pdf.pages)

    def extract_with_pdfplumber(self, page_num=0, rotation=0, region=None):
        """Extract text with coordinates using pdfplumber"""
        extracted_data = []

        with pdfplumber.open(self.pdf_path) as pdf:
            if page_num >= len(pdf.pages):
                return extracted_data

            page = pdf.pages[page_num]

            if region:
                page = page.crop(region)

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
        """Extract text using Tesseract OCR with PyMuPDF conversion"""
        try:
            # Use PyMuPDF to convert PDF page to image
            doc = fitz.open(self.pdf_path)

            if page_num >= len(doc):
                doc.close()
                return "", []

            page = doc[page_num]

            # Render page to pixmap with high DPI for OCR
            zoom = 300 / 72  # 300 DPI
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)

            # Convert pixmap to PIL Image
            img_data = pix.tobytes("png")
            image = Image.open(io.BytesIO(img_data))

            doc.close()

            # Apply rotation if needed
            if rotation != 0:
                image = image.rotate(-rotation, expand=True)

            # Run Tesseract OCR
            custom_config = f'--psm {psm_mode} --oem 3'
            text = pytesseract.image_to_string(image, config=custom_config, lang='ita+eng')

            data = pytesseract.image_to_data(
                image,
                config=custom_config,
                lang='ita+eng',
                output_type=pytesseract.Output.DICT
            )

            return text, data

        except Exception as e:
            print(f"Error during OCR extraction: {e}")
            return "", []

    def get_page_image(self, page_num=0, dpi=150):
        """Convert PDF page to base64 encoded image using PyMuPDF"""
        try:
            # Use PyMuPDF (fitz) for reliable image conversion
            doc = fitz.open(self.pdf_path)

            if page_num >= len(doc):
                doc.close()
                return None

            page = doc[page_num]

            # Render page to pixmap
            zoom = dpi / 72  # Convert DPI to zoom factor
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)

            # Convert pixmap to PIL Image
            img_data = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_data))

            doc.close()

            # Convert to base64
            buffered = io.BytesIO()
            img.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode()
            return img_str

        except Exception as e:
            print(f"Error converting PDF page to image: {e}")
            return None


@app.route('/')
def index():
    return render_template('pdf_analyzer.html')


@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], 'current.pdf')
        file.save(filepath)

        processor = PDFProcessor(filepath)
        pdf_type, pages_info = processor.detect_pdf_type()
        page_count = processor.get_page_count()

        # Extract full text
        if pdf_type in ['textual', 'hybrid']:
            full_text = processor.get_full_text_pdfplumber()
        else:
            all_text = []
            for i in range(min(3, page_count)):
                text, _ = processor.extract_with_ocr(page_num=i, psm_mode=6)
                all_text.append(f"--- Page {i + 1} ---\n{text}\n")
            full_text = "\n".join(all_text)

        # Get first page image
        page_image = processor.get_page_image(page_num=0)

        return jsonify({
            'success': True,
            'pdf_type': pdf_type,
            'page_count': page_count,
            'pages_info': pages_info,
            'full_text': full_text,
            'page_image': page_image
        })

    return jsonify({'error': 'Invalid file type'}), 400


@app.route('/get_page/<int:page_num>')
def get_page(page_num):
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], 'current.pdf')
    if not os.path.exists(filepath):
        return jsonify({'error': 'No PDF loaded'}), 400

    processor = PDFProcessor(filepath)
    page_image = processor.get_page_image(page_num=page_num)

    return jsonify({
        'success': True,
        'page_image': page_image
    })


@app.route('/extract_pdfplumber', methods=['POST'])
def extract_pdfplumber():
    data = request.json
    page_num = data.get('page_num', 0)
    rotation = data.get('rotation', 0)

    filepath = os.path.join(app.config['UPLOAD_FOLDER'], 'current.pdf')
    if not os.path.exists(filepath):
        return jsonify({'error': 'No PDF loaded'}), 400

    processor = PDFProcessor(filepath)
    extracted_data = processor.extract_with_pdfplumber(
        page_num=page_num,
        rotation=rotation
    )

    return jsonify({
        'success': True,
        'data': extracted_data,
        'word_count': len(extracted_data)
    })


@app.route('/extract_ocr', methods=['POST'])
def extract_ocr():
    data = request.json
    page_num = data.get('page_num', 0)
    psm_mode = data.get('psm_mode', 6)
    rotation = data.get('rotation', 0)

    filepath = os.path.join(app.config['UPLOAD_FOLDER'], 'current.pdf')
    if not os.path.exists(filepath):
        return jsonify({'error': 'No PDF loaded'}), 400

    processor = PDFProcessor(filepath)
    text, ocr_data = processor.extract_with_ocr(
        page_num=page_num,
        psm_mode=psm_mode,
        rotation=rotation
    )

    # Check if OCR failed (returns empty list)
    if not ocr_data or not isinstance(ocr_data, dict):
        return jsonify({'error': 'OCR extraction failed'}), 500

    # Format OCR data
    words = []
    if 'text' in ocr_data:
        for i, word in enumerate(ocr_data['text']):
            if word.strip():
                words.append({
                    'text': word,
                    'conf': ocr_data['conf'][i],
                    'left': ocr_data['left'][i],
                    'top': ocr_data['top'][i],
                    'width': ocr_data['width'][i],
                    'height': ocr_data['height'][i]
                })

    return jsonify({
        'success': True,
        'text': text,
        'words': words,
        'word_count': len(words)
    })


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
