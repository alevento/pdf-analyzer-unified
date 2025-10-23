// Global state
let currentZoom = 100;
let currentHighlightedNumbers = [];
let currentNumbers = [];
let currentPageCount = 1;
let currentPage = 0;
let currentMode = 'numbers'; // 'numbers', 'pdfplumber', 'ocr', 'ai'
let currentPageImage = null; // Store current page image for AI vision
let currentDisplayData = null; // Store currently displayed data for download

// DOM elements
let fileInput, uploadBtn, status, imageContainer, textList;
let pageSelectNumbers, pageSelectPdfplumber, pageSelectOcr;
let confidenceThreshold, rotationSelect, psmSelect;
let extractNumbersBtn, extractPdfplumberBtn, extractOcrBtn;
let zoomControls, legend, numberCount, selectedText;
let analyzeBtn, visionBtn, askBtn, summarizeBtn, questionInput, opusStatus;

document.addEventListener('DOMContentLoaded', function() {
    // Get all DOM elements
    fileInput = document.getElementById('fileInput');
    uploadBtn = document.getElementById('uploadBtn');
    status = document.getElementById('status');
    imageContainer = document.getElementById('imageContainer');
    textList = document.getElementById('textList');

    pageSelectNumbers = document.getElementById('pageSelectNumbers');
    pageSelectPdfplumber = document.getElementById('pageSelectPdfplumber');
    pageSelectOcr = document.getElementById('pageSelectOcr');

    confidenceThreshold = document.getElementById('confidenceThreshold');
    rotationSelect = document.getElementById('rotationSelect');
    psmSelect = document.getElementById('psmSelect');

    extractNumbersBtn = document.getElementById('extractNumbersBtn');
    extractPdfplumberBtn = document.getElementById('extractPdfplumberBtn');
    extractOcrBtn = document.getElementById('extractOcrBtn');

    zoomControls = document.getElementById('zoomControls');
    legend = document.getElementById('legend');
    numberCount = document.getElementById('numberCount');
    selectedText = document.getElementById('selectedText');

    // AI elements
    analyzeBtn = document.getElementById('analyzeBtn');
    visionBtn = document.getElementById('visionBtn');
    askBtn = document.getElementById('askBtn');
    summarizeBtn = document.getElementById('summarizeBtn');
    questionInput = document.getElementById('questionInput');
    opusStatus = document.getElementById('opusStatus');

    // Event listeners
    uploadBtn.addEventListener('click', uploadFile);
    fileInput.addEventListener('change', handleFileSelect);

    // AI event listeners
    analyzeBtn.addEventListener('click', handleAnalyze);
    visionBtn.addEventListener('click', handleVision);
    askBtn.addEventListener('click', handleAsk);
    summarizeBtn.addEventListener('click', handleSummarize);

    // Check AI status and load providers on page load
    loadAIProviders();
    checkAIStatus();

    // Zoom controls
    document.getElementById('zoomIn').addEventListener('click', () => zoomImage(25));
    document.getElementById('zoomOut').addEventListener('click', () => zoomImage(-25));
    document.getElementById('zoomReset').addEventListener('click', () => setZoom(100));

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Extract buttons
    extractNumbersBtn.addEventListener('click', handleExtractNumbers);
    extractPdfplumberBtn.addEventListener('click', handleExtractPdfplumber);
    extractOcrBtn.addEventListener('click', handleExtractOcr);
});

function handleFileSelect() {
    if (fileInput.files.length > 0) {
        uploadBtn.disabled = false;
        status.textContent = 'File selezionato: ' + fileInput.files[0].name;
    } else {
        status.textContent = '';
    }
}

function switchTab(tabName) {
    currentMode = tabName;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update control sections
    document.querySelectorAll('.control-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(tabName + '-controls').classList.add('active');

    // Show/hide legend only for numbers mode
    legend.style.display = (tabName === 'numbers') ? 'flex' : 'none';
}

async function uploadFile() {
    if (!fileInput.files || fileInput.files.length === 0) {
        status.textContent = 'Seleziona un file PDF';
        return;
    }

    const file = fileInput.files[0];
    if (!file.name.toLowerCase().endsWith('.pdf')) {
        status.textContent = 'Errore: Il file deve essere un PDF';
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    uploadBtn.disabled = true;
    status.textContent = 'Caricamento...';
    imageContainer.innerHTML = '<p class="loading">Caricamento PDF...</p>';
    textList.innerHTML = '<p class="placeholder">Attendi...</p>';

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            currentPageCount = data.page_count;
            currentPage = 0;

            // Update PDF type badge
            const pdfTypeBadge = document.getElementById('pdfTypeBadge');
            if (pdfTypeBadge) {
                const typeLabels = {
                    'textual': 'PDF Testuale',
                    'hybrid': 'PDF Ibrido',
                    'rasterized': 'PDF Rasterizzato'
                };
                pdfTypeBadge.textContent = typeLabels[data.pdf_type] || data.pdf_type;
                pdfTypeBadge.className = 'pdf-type-badge ' + data.pdf_type;
                pdfTypeBadge.style.display = 'block';
            }

            // Update all page selectors
            [pageSelectNumbers, pageSelectPdfplumber, pageSelectOcr].forEach(select => {
                select.max = data.page_count;
                select.value = 1;
                select.disabled = false;
            });

            // Enable controls
            confidenceThreshold.disabled = false;
            rotationSelect.disabled = false;
            psmSelect.disabled = false;
            extractNumbersBtn.disabled = false;
            extractPdfplumberBtn.disabled = false;
            extractOcrBtn.disabled = false;

            // Enable AI controls if provider is available
            checkAIStatus().then(() => {
                if (opusStatus.textContent.includes('✓')) {
                    analyzeBtn.disabled = false;
                    visionBtn.disabled = false;
                    askBtn.disabled = false;
                    summarizeBtn.disabled = false;
                    questionInput.disabled = false;
                }
            });

            // Display first page with boxes
            displayImage(data.page_image);

            // Se ci sono numeri estratti automaticamente, visualizzali
            if (data.has_numbers && data.numbers && data.numbers.length > 0) {
                currentNumbers = data.numbers;
                currentDisplayData = data.numbers; // Store for download
                displayNumbersList(data.numbers);

                // Costruisci messaggio contatore basato sul metodo di estrazione
                let countMessage = `Trovati ${data.numbers_count} elementi`;
                if (data.extraction_method === 'pdfplumber' && data.type_counts) {
                    const types = [];
                    if (data.type_counts.number) types.push(`${data.type_counts.number} numeri`);
                    if (data.type_counts.date) types.push(`${data.type_counts.date} date`);
                    if (data.type_counts.reference) types.push(`${data.type_counts.reference} riferimenti`);
                    if (data.type_counts.unit) types.push(`${data.type_counts.unit} unità`);
                    countMessage = `Trovati: ${types.join(', ')}`;
                } else if (data.extraction_method === 'ocr' && data.type_counts) {
                    countMessage = `Trovati ${data.numbers_count} numeri (${data.type_counts['0deg'] || 0} orizzontali + ${data.type_counts['90deg'] || 0} verticali)`;
                }

                numberCount.textContent = countMessage;
                numberCount.style.display = 'block';
                legend.style.display = 'flex';

                // Show download buttons
                document.getElementById('downloadButtons').style.display = 'block';

                status.textContent = `PDF caricato: ${data.page_count} pagine, tipo ${data.pdf_type} - Metodo: ${data.extraction_method}`;
            } else {
                // Fallback: mostra solo il testo
                textList.innerHTML = '<pre style="padding: 15px; font-size: 11px; line-height: 1.4;">' + data.full_text + '</pre>';
                status.textContent = `PDF caricato: ${data.page_count} pagine, tipo ${data.pdf_type}`;
            }
        } else {
            status.textContent = 'Errore: ' + (data.error || 'Errore sconosciuto');
            imageContainer.innerHTML = '<p class="placeholder">Errore durante il caricamento</p>';
        }
    } catch (error) {
        status.textContent = 'Errore di connessione: ' + error.message;
    } finally {
        uploadBtn.disabled = false;
    }
}

async function handleExtractNumbers() {
    const pageNum = parseInt(pageSelectNumbers.value) - 1;
    const minConf = parseInt(confidenceThreshold.value);

    status.textContent = 'Estrazione numeri avanzata in corso...';
    extractNumbersBtn.disabled = true;
    imageContainer.innerHTML = '<p class="loading">Analisi con OCR 0° + 90°...</p>';
    textList.innerHTML = '<p class="loading">Estrazione...</p>';

    try {
        const response = await fetch('/extract_numbers_advanced', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({page_num: pageNum, min_conf: minConf})
        });

        const data = await response.json();

        if (data.success) {
            currentNumbers = data.numbers;
            currentDisplayData = data.numbers; // Store for download
            displayImage(data.image);
            displayNumbersList(data.numbers);
            numberCount.textContent = `Trovati ${data.count} numeri (${data.count_0deg} orizzontali + ${data.count_90deg} verticali)`;
            numberCount.style.display = 'block';
            legend.style.display = 'flex';

            // Show download buttons
            document.getElementById('downloadButtons').style.display = 'block';

            status.textContent = `Completato! ${data.count} numeri estratti (soglia ${minConf}%)`;
        } else {
            status.textContent = 'Errore: ' + data.error;
        }
    } catch (error) {
        status.textContent = 'Errore: ' + error.message;
    } finally {
        extractNumbersBtn.disabled = false;
    }
}

async function handleExtractPdfplumber() {
    const pageNum = parseInt(pageSelectPdfplumber.value) - 1;
    const rotation = parseInt(rotationSelect.value);

    status.textContent = 'Estrazione con pdfplumber...';
    extractPdfplumberBtn.disabled = true;
    textList.innerHTML = '<p class="loading">Estrazione...</p>';

    try {
        const response = await fetch('/extract_pdfplumber', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({page_num: pageNum, rotation: rotation})
        });

        const data = await response.json();

        if (data.success) {
            // Convert PDFPlumber data to downloadable format
            currentDisplayData = convertPdfplumberToDownloadFormat(data.data, pageNum + 1, rotation);
            document.getElementById('downloadButtons').style.display = 'block';

            let output = `=== Pagina ${pageNum + 1} - Estrazione pdfplumber ===\n\n`;
            data.data.forEach(item => {
                output += `Testo: '${item.text}'\n`;
                output += `  Posizione: (${item.x0.toFixed(2)}, ${item.y0.toFixed(2)}) -> (${item.x1.toFixed(2)}, ${item.y1.toFixed(2)})\n`;
                output += `  Dimensioni: ${item.width.toFixed(2)} x ${item.height.toFixed(2)}\n\n`;
            });
            output += `\nTotale parole estratte: ${data.word_count}\n`;
            textList.innerHTML = '<pre style="padding: 15px; font-size: 11px; line-height: 1.4;">' + output + '</pre>';
            status.textContent = `Estratte ${data.word_count} parole con pdfplumber`;
        } else {
            status.textContent = 'Errore: ' + data.error;
        }
    } catch (error) {
        status.textContent = 'Errore: ' + error.message;
    } finally {
        extractPdfplumberBtn.disabled = false;
    }
}

async function handleExtractOcr() {
    const pageNum = parseInt(pageSelectOcr.value) - 1;
    const psmMode = parseInt(psmSelect.value);

    status.textContent = 'Estrazione con OCR...';
    extractOcrBtn.disabled = true;
    textList.innerHTML = '<p class="loading">Estrazione...</p>';

    try {
        const response = await fetch('/extract_ocr', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({page_num: pageNum, psm_mode: psmMode, rotation: 0})
        });

        const data = await response.json();

        if (data.success) {
            let totalConf = 0;
            let confCount = 0;
            data.words.forEach(word => {
                if (word.conf >= 0) {
                    totalConf += word.conf;
                    confCount++;
                }
            });
            const avgConf = confCount > 0 ? (totalConf / confCount).toFixed(1) : 0;

            // Convert OCR data to downloadable format
            currentDisplayData = convertOcrToDownloadFormat(data.words, data.text, pageNum + 1, psmMode, avgConf);
            document.getElementById('downloadButtons').style.display = 'block';

            let output = `=== Pagina ${pageNum + 1} - Estrazione OCR (PSM ${psmMode}) ===\n`;
            output += `Confidenza media: ${avgConf}%\n`;
            output += `Parole estratte: ${data.word_count}\n\n`;
            output += '--- TESTO ESTRATTO ---\n\n';
            output += data.text;
            textList.innerHTML = '<pre style="padding: 15px; font-size: 11px; line-height: 1.4;">' + output + '</pre>';
            status.textContent = `Estrazione OCR completa: ${data.word_count} parole, confidenza media ${avgConf}%`;
        } else {
            status.textContent = 'Errore: ' + data.error;
        }
    } catch (error) {
        status.textContent = 'Errore: ' + error.message;
    } finally {
        extractOcrBtn.disabled = false;
    }
}

function displayImage(imageBase64) {
    currentPageImage = imageBase64; // Store for AI vision
    imageContainer.innerHTML = '';
    const img = document.createElement('img');
    img.src = imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`;
    img.id = 'mainImage';
    img.addEventListener('click', handleImageClick);
    imageContainer.appendChild(img);
    zoomControls.style.display = 'flex';
    applyZoom();
}

function handleImageClick(event) {
    if (!currentNumbers || currentNumbers.length === 0) return;

    const img = event.target;
    const rect = img.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Scala in base alle dimensioni naturali dell'immagine
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;
    const actualX = x * scaleX;
    const actualY = y * scaleY;

    console.log('Click at:', actualX, actualY, 'Scale:', scaleX, scaleY);

    const clickedNumber = findNumberAtPosition(actualX, actualY, currentNumbers);
    if (clickedNumber) {
        console.log('Found number:', clickedNumber.text, 'ID:', clickedNumber.id);
        highlightNumber(clickedNumber.id || 0);
    } else {
        console.log('No number found at this position');
    }
}

function findNumberAtPosition(x, y, numbers) {
    let foundNumbers = [];
    for (const number of numbers) {
        const bbox = number.bbox;

        // Se i dati vengono da pdfplumber, le coordinate sono in punti PDF (72 DPI)
        // ma l'immagine è renderizzata a 300 DPI, quindi dobbiamo scalare
        let bboxX, bboxY, bboxWidth, bboxHeight;

        if (number.source === 'pdfplumber') {
            // Scala da 72 DPI a 300 DPI (stesso fattore usato in draw_pdfplumber_boxes)
            const scale = 300 / 72.0;
            bboxX = bbox.x * scale;
            bboxY = bbox.y * scale;
            bboxWidth = bbox.width * scale;
            bboxHeight = bbox.height * scale;
            console.log('Checking pdfplumber bbox (scaled):', bboxX, bboxY, bboxWidth, bboxHeight, 'for text:', number.text);
        } else {
            // OCR coordinates are already at 300 DPI
            bboxX = bbox.x;
            bboxY = bbox.y;
            bboxWidth = bbox.width;
            bboxHeight = bbox.height;
        }

        if (x >= bboxX && x <= bboxX + bboxWidth &&
            y >= bboxY && y <= bboxY + bboxHeight) {
            foundNumbers.push({
                number: number,
                area: bboxWidth * bboxHeight
            });
        }
    }
    if (foundNumbers.length > 0) {
        foundNumbers.sort((a, b) => a.area - b.area);
        return foundNumbers[0].number;
    }
    return null;
}

function displayNumbersList(numbers) {
    textList.innerHTML = '';
    if (numbers.length === 0) {
        textList.innerHTML = '<p class="placeholder">Nessun numero trovato</p>';
        return;
    }

    const groupedNumbers = {};
    numbers.forEach((result) => {
        const key = result.text.trim().toLowerCase();
        if (!groupedNumbers[key]) {
            groupedNumbers[key] = {
                text: result.text,
                occurrences: [],
                maxConfidence: result.confidence,
                source: result.source
            };
        }
        groupedNumbers[key].occurrences.push(result);
        groupedNumbers[key].maxConfidence = Math.max(groupedNumbers[key].maxConfidence, result.confidence);
    });

    const sortedGroups = Object.values(groupedNumbers).sort((a, b) => {
        const numA = parseFloat(a.text.replace(/[^\d.-]/g, '')) || 0;
        const numB = parseFloat(b.text.replace(/[^\d.-]/g, '')) || 0;
        return numA !== numB ? numA - numB : a.text.localeCompare(b.text);
    });

    sortedGroups.forEach((group) => {
        const item = document.createElement('div');
        item.className = 'text-item';
        item.dataset.id = group.occurrences[0].id || 0;

        const textContent = document.createElement('span');
        textContent.className = 'text-content';
        textContent.textContent = group.text;

        const infoContainer = document.createElement('div');
        infoContainer.className = 'text-info';

        if (group.occurrences.length > 1) {
            const count = document.createElement('span');
            count.className = 'text-count';
            count.textContent = `×${group.occurrences.length}`;
            infoContainer.appendChild(count);
        }

        const confidence = document.createElement('span');
        confidence.className = 'text-confidence';
        confidence.textContent = `${group.maxConfidence}%`;
        infoContainer.appendChild(confidence);

        // Tag per tipo/source
        const typeTag = document.createElement('span');
        if (group.occurrences[0].type) {
            // pdfplumber: mostra tipo (number, date, reference, unit)
            const typeLabels = {
                'number': 'N',
                'date': 'D',
                'reference': 'R',
                'unit': 'U'
            };
            const typeColors = {
                'number': 'source-0deg',
                'date': 'source-date',
                'reference': 'source-ref',
                'unit': 'source-unit'
            };
            typeTag.className = `text-source ${typeColors[group.occurrences[0].type] || 'source-0deg'}`;
            typeTag.textContent = typeLabels[group.occurrences[0].type] || 'N';
        } else if (group.source) {
            // OCR: mostra H/V
            typeTag.className = `text-source source-${group.source}`;
            typeTag.textContent = group.source === '0deg' ? 'H' : 'V';
        }
        infoContainer.appendChild(typeTag);

        item.appendChild(textContent);
        item.appendChild(infoContainer);
        item.addEventListener('click', () => highlightNumber(group.occurrences[0].id || 0));
        textList.appendChild(item);
    });
}

async function highlightNumber(numberId) {
    document.querySelectorAll('.text-item').forEach(item => {
        item.classList.remove('highlighted');
    });

    const selectedNumber = currentNumbers.find(n => (n.id || 0) === numberId);
    if (!selectedNumber) return;

    const sameValueNumbers = currentNumbers.filter(n =>
        n.text.trim().toLowerCase() === selectedNumber.text.trim().toLowerCase()
    );

    currentHighlightedNumbers = sameValueNumbers;

    sameValueNumbers.forEach(num => {
        const item = document.querySelector(`.text-item[data-id="${num.id || 0}"]`);
        if (item) {
            item.classList.add('highlighted');
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });

    const count = sameValueNumbers.length;
    const countText = count > 1 ? ` (${count} occorrenze)` : '';
    selectedText.textContent = selectedNumber.text + countText;

    addMultipleHighlightOverlays(sameValueNumbers);

    try {
        const response = await fetch(`/highlight/${numberId}`);
        const data = await response.json();
        if (data.success) {
            updateImageOnly(data.image);
            setTimeout(() => {
                addMultipleHighlightOverlays(sameValueNumbers);
            }, 100);
        }
    } catch (error) {
        console.error('Errore evidenziazione:', error);
    }
}

function updateImageOnly(imageBase64) {
    const img = document.getElementById('mainImage');
    if (img) {
        img.src = imageBase64;
    }
}

function addMultipleHighlightOverlays(numbers) {
    document.querySelectorAll('.highlight-overlay').forEach(el => el.remove());

    const img = document.getElementById('mainImage');
    if (!img || !numbers || numbers.length === 0) return;

    if (!img.complete) {
        img.onload = () => addMultipleHighlightOverlays(numbers);
        return;
    }

    const scaleX = img.width / img.naturalWidth;
    const scaleY = img.height / img.naturalHeight;
    const imgRect = img.getBoundingClientRect();
    const containerRect = imageContainer.getBoundingClientRect();
    const offsetX = imgRect.left - containerRect.left + imageContainer.scrollLeft;
    const offsetY = imgRect.top - containerRect.top + imageContainer.scrollTop;

    numbers.forEach((number, index) => {
        const bbox = number.bbox;
        let x, y, w, h;

        if (number.source === 'pdfplumber') {
            // Scala da 72 DPI a 300 DPI prima di applicare lo zoom
            const dpiScale = 300 / 72.0;
            x = bbox.x * dpiScale * scaleX;
            y = bbox.y * dpiScale * scaleY;
            w = bbox.width * dpiScale * scaleX;
            h = bbox.height * dpiScale * scaleY;
        } else {
            // OCR coordinates are already at 300 DPI
            x = bbox.x * scaleX;
            y = bbox.y * scaleY;
            w = bbox.width * scaleX;
            h = bbox.height * scaleY;
        }

        const overlay = document.createElement('div');
        overlay.className = 'highlight-overlay';
        overlay.style.left = (offsetX + x) + 'px';
        overlay.style.top = (offsetY + y) + 'px';
        overlay.style.width = w + 'px';
        overlay.style.height = h + 'px';
        overlay.style.animationDelay = (index * 0.1) + 's';
        imageContainer.appendChild(overlay);
    });
}

function zoomImage(delta) {
    currentZoom += delta;
    if (currentZoom < 25) currentZoom = 25;
    if (currentZoom > 300) currentZoom = 300;
    applyZoom();
}

function setZoom(zoomLevel) {
    currentZoom = zoomLevel;
    applyZoom();
}

function applyZoom() {
    const img = document.getElementById('mainImage');
    const zoomLevel = document.getElementById('zoomLevel');
    if (img) {
        img.style.width = currentZoom + '%';
        zoomLevel.textContent = currentZoom + '%';
        if (currentHighlightedNumbers.length > 0) {
            setTimeout(() => {
                addMultipleHighlightOverlays(currentHighlightedNumbers);
            }, 50);
        }
    }
}

// ============================================================================
// AI ANALYSIS FUNCTIONS (AI PROVIDER INTEGRATION)
// ============================================================================

async function handleAnalyze() {
    const providerName = document.getElementById('aiProviderSelect').selectedOptions[0]?.text || 'AI';
    textList.innerHTML = `<div class="ai-loading">🤖 Analisi in corso con ${providerName}...</div>`;
    analyzeBtn.disabled = true;
    status.textContent = 'Analisi AI in corso...';

    try {
        const response = await fetch('/opus/analyze', { method: 'POST' });
        const data = await response.json();

        if (data.error) {
            textList.innerHTML = `<div class="ai-error"><strong>Errore:</strong> ${data.error}</div>`;
            status.textContent = 'Errore analisi AI';
            document.getElementById('downloadButtons').style.display = 'none';
            currentDisplayData = null;
        } else if (data.success && data.analysis) {
            displayAnalysisResults(data.analysis, providerName);

            // Convert analysis to downloadable format (array of items)
            currentDisplayData = convertAnalysisToDownloadFormat(data.analysis, providerName);
            document.getElementById('downloadButtons').style.display = 'block';

            status.textContent = 'Analisi AI completata';
        }
    } catch (error) {
        textList.innerHTML = `<div class="ai-error"><strong>Errore:</strong> ${error.message}</div>`;
        status.textContent = 'Errore connessione AI';
        document.getElementById('downloadButtons').style.display = 'none';
        currentDisplayData = null;
    } finally {
        analyzeBtn.disabled = false;
    }
}

async function handleVision() {
    if (!currentPageImage) {
        status.textContent = 'Carica prima un PDF';
        return;
    }

    document.getElementById('downloadButtons').style.display = 'none';
    currentDisplayData = null;

    const providerName = document.getElementById('aiProviderSelect').selectedOptions[0]?.text || 'AI';
    textList.innerHTML = `<div class="ai-loading">👁️ Analisi visione in corso con ${providerName}...</div>`;
    visionBtn.disabled = true;
    status.textContent = 'Analisi visione AI in corso...';

    try {
        const response = await fetch('/opus/vision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: currentPageImage })
        });
        const data = await response.json();

        if (data.error) {
            textList.innerHTML = `<div class="ai-error"><strong>Errore:</strong> ${data.error}</div>`;
            status.textContent = 'Errore visione AI';
            document.getElementById('downloadButtons').style.display = 'none';
            currentDisplayData = null;
        } else if (data.success && data.vision_analysis) {
            textList.innerHTML = `
                <div class="ai-result">
                    <h3>🔍 Analisi Visione ${providerName}</h3>
                    <div class="ai-result-item">
                        <pre>${escapeHtml(data.vision_analysis)}</pre>
                    </div>
                </div>
            `;

            // Convert vision analysis to downloadable format
            currentDisplayData = convertVisionToDownloadFormat(data.vision_analysis, providerName);
            document.getElementById('downloadButtons').style.display = 'block';

            status.textContent = 'Analisi visione AI completata';
        }
    } catch (error) {
        textList.innerHTML = `<div class="ai-error"><strong>Errore:</strong> ${error.message}</div>`;
        status.textContent = 'Errore connessione AI';
        document.getElementById('downloadButtons').style.display = 'none';
        currentDisplayData = null;
    } finally {
        visionBtn.disabled = false;
    }
}

async function handleAsk() {
    const question = questionInput.value.trim();
    if (!question) {
        alert('Inserisci una domanda');
        return;
    }

    document.getElementById('downloadButtons').style.display = 'none';
    currentDisplayData = null;

    const providerName = document.getElementById('aiProviderSelect').selectedOptions[0]?.text || 'AI';
    textList.innerHTML = `<div class="ai-loading">💬 ${providerName} sta pensando...</div>`;
    askBtn.disabled = true;
    status.textContent = 'Elaborazione domanda...';

    try {
        const response = await fetch('/opus/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: question })
        });
        const data = await response.json();

        if (data.error) {
            textList.innerHTML = `<div class="ai-error"><strong>Errore:</strong> ${data.error}</div>`;
            status.textContent = 'Errore Q&A AI';
            document.getElementById('downloadButtons').style.display = 'none';
            currentDisplayData = null;
        } else if (data.success && data.answer) {
            textList.innerHTML = `
                <div class="ai-result">
                    <h3>❓ Domanda</h3>
                    <div class="ai-result-item">
                        <strong>${escapeHtml(question)}</strong>
                    </div>
                    <h3 style="margin-top: 15px;">💡 Risposta ${providerName}</h3>
                    <div class="ai-result-item">
                        <pre>${escapeHtml(data.answer)}</pre>
                    </div>
                </div>
            `;

            // Convert Q&A to downloadable format
            currentDisplayData = convertQAToDownloadFormat(question, data.answer, providerName);
            document.getElementById('downloadButtons').style.display = 'block';

            status.textContent = 'Risposta ricevuta';
        }
    } catch (error) {
        textList.innerHTML = `<div class="ai-error"><strong>Errore:</strong> ${error.message}</div>`;
        status.textContent = 'Errore connessione AI';
        document.getElementById('downloadButtons').style.display = 'none';
        currentDisplayData = null;
    } finally {
        askBtn.disabled = false;
    }
}

async function handleSummarize() {
    const providerName = document.getElementById('aiProviderSelect').selectedOptions[0]?.text || 'AI';
    textList.innerHTML = `<div class="ai-loading">📝 Creazione riepilogo con ${providerName}...</div>`;
    summarizeBtn.disabled = true;
    status.textContent = 'Creazione riepilogo AI...';

    try {
        const response = await fetch('/opus/summarize', { method: 'POST' });
        const data = await response.json();

        if (data.error) {
            textList.innerHTML = `<div class="ai-error"><strong>Errore:</strong> ${data.error}</div>`;
            status.textContent = 'Errore riepilogo AI';
            document.getElementById('downloadButtons').style.display = 'none';
            currentDisplayData = null;
        } else if (data.success && data.summary) {
            displaySummaryResults(data.summary, providerName);

            // Convert summary to downloadable format (array of items)
            currentDisplayData = convertSummaryToDownloadFormat(data.summary, providerName);
            document.getElementById('downloadButtons').style.display = 'block';

            status.textContent = 'Riepilogo AI completato';
        }
    } catch (error) {
        textList.innerHTML = `<div class="ai-error"><strong>Errore:</strong> ${error.message}</div>`;
        status.textContent = 'Errore connessione AI';
        document.getElementById('downloadButtons').style.display = 'none';
        currentDisplayData = null;
    } finally {
        summarizeBtn.disabled = false;
    }
}

function displayAnalysisResults(analysis, providerName = 'AI') {
    let html = `<div class="ai-result"><h3>🔬 Analisi Intelligente ${providerName}</h3>`;

    if (analysis.numeri_chiave && analysis.numeri_chiave.length > 0) {
        html += '<h4 style="margin-top: 10px; color: #2c3e50;">📊 Numeri Chiave</h4>';
        analysis.numeri_chiave.forEach(item => {
            html += `<div class="ai-result-item">${escapeHtml(item)}</div>`;
        });
    }

    if (analysis.date_critiche && analysis.date_critiche.length > 0) {
        html += '<h4 style="margin-top: 10px; color: #2c3e50;">📅 Date Critiche</h4>';
        analysis.date_critiche.forEach(item => {
            html += `<div class="ai-result-item">${escapeHtml(item)}</div>`;
        });
    }

    if (analysis.riferimenti && analysis.riferimenti.length > 0) {
        html += '<h4 style="margin-top: 10px; color: #2c3e50;">🔗 Riferimenti</h4>';
        analysis.riferimenti.forEach(item => {
            html += `<div class="ai-result-item">${escapeHtml(item)}</div>`;
        });
    }

    if (analysis.anomalie && analysis.anomalie.length > 0) {
        html += '<h4 style="margin-top: 10px; color: #e74c3c;">⚠️ Anomalie</h4>';
        analysis.anomalie.forEach(item => {
            html += `<div class="ai-result-item" style="border-left-color: #e74c3c;">${escapeHtml(item)}</div>`;
        });
    }

    if (analysis.pattern && analysis.pattern.length > 0) {
        html += '<h4 style="margin-top: 10px; color: #2c3e50;">🔍 Pattern Identificati</h4>';
        analysis.pattern.forEach(item => {
            html += `<div class="ai-result-item">${escapeHtml(item)}</div>`;
        });
    }

    if (analysis.riepilogo) {
        html += '<h4 style="margin-top: 10px; color: #2c3e50;">📋 Riepilogo</h4>';
        html += `<div class="ai-result-item"><strong>${escapeHtml(analysis.riepilogo)}</strong></div>`;
    }

    html += '</div>';
    textList.innerHTML = html;
}

function displaySummaryResults(summary, providerName = 'AI') {
    let html = `<div class="ai-result"><h3>📄 Riepilogo Documento ${providerName}</h3>`;

    if (summary.tipo_documento) {
        html += `<div class="ai-result-item"><strong>Tipo:</strong> ${escapeHtml(summary.tipo_documento)}</div>`;
    }

    if (summary.scopo) {
        html += `<div class="ai-result-item"><strong>Scopo:</strong> ${escapeHtml(summary.scopo)}</div>`;
    }

    if (summary.informazioni_chiave && summary.informazioni_chiave.length > 0) {
        html += '<h4 style="margin-top: 10px; color: #2c3e50;">ℹ️ Informazioni Chiave</h4>';
        summary.informazioni_chiave.forEach(item => {
            html += `<div class="ai-result-item">${escapeHtml(item)}</div>`;
        });
    }

    if (summary.numeri_rilevanti && summary.numeri_rilevanti.length > 0) {
        html += '<h4 style="margin-top: 10px; color: #2c3e50;">🔢 Numeri Rilevanti</h4>';
        summary.numeri_rilevanti.forEach(item => {
            html += `<div class="ai-result-item">${escapeHtml(item)}</div>`;
        });
    }

    if (summary.date_importanti && summary.date_importanti.length > 0) {
        html += '<h4 style="margin-top: 10px; color: #2c3e50;">📅 Date Importanti</h4>';
        summary.date_importanti.forEach(item => {
            html += `<div class="ai-result-item">${escapeHtml(item)}</div>`;
        });
    }

    if (summary.riferimenti && summary.riferimenti.length > 0) {
        html += '<h4 style="margin-top: 10px; color: #2c3e50;">🔗 Riferimenti</h4>';
        summary.riferimenti.forEach(item => {
            html += `<div class="ai-result-item">${escapeHtml(item)}</div>`;
        });
    }

    if (summary.conclusioni) {
        html += '<h4 style="margin-top: 10px; color: #27ae60;">✅ Conclusioni</h4>';
        html += `<div class="ai-result-item" style="border-left-color: #27ae60;"><strong>${escapeHtml(summary.conclusioni)}</strong></div>`;
    }

    html += '</div>';
    textList.innerHTML = html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// DOWNLOAD RESULTS FUNCTION
// ============================================================================

async function downloadResults(format) {
    if (!currentDisplayData || currentDisplayData.length === 0) {
        alert('Nessun dato da scaricare');
        return;
    }

    try {
        const response = await fetch(`/download_results/${format}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({data: currentDisplayData})
        });

        if (response.ok) {
            // Create blob and download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            // Get filename from Content-Disposition header if available
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `pdf_extraction_${Date.now()}.${format}`;
            if (contentDisposition) {
                const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            }

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            status.textContent = `Download completato: ${filename}`;
        } else {
            alert('Errore durante il download');
        }
    } catch (error) {
        alert('Errore: ' + error.message);
    }
}

// ============================================================================
// AI DATA CONVERSION FUNCTIONS FOR DOWNLOAD
// ============================================================================

function convertAnalysisToDownloadFormat(analysis, providerName = 'AI') {
    // Convert AI analysis object to array format suitable for download
    const items = [];
    let id = 0;

    // Add key numbers
    if (analysis.numeri_chiave && analysis.numeri_chiave.length > 0) {
        analysis.numeri_chiave.forEach(item => {
            items.push({
                id: id++,
                text: item,
                type: 'numero_chiave',
                confidence: 100,
                source: 'ai_analysis',
                provider: providerName
            });
        });
    }

    // Add critical dates
    if (analysis.date_critiche && analysis.date_critiche.length > 0) {
        analysis.date_critiche.forEach(item => {
            items.push({
                id: id++,
                text: item,
                type: 'data_critica',
                confidence: 100,
                source: 'ai_analysis',
                provider: providerName
            });
        });
    }

    // Add references
    if (analysis.riferimenti && analysis.riferimenti.length > 0) {
        analysis.riferimenti.forEach(item => {
            items.push({
                id: id++,
                text: item,
                type: 'riferimento',
                confidence: 100,
                source: 'ai_analysis',
                provider: providerName
            });
        });
    }

    // Add anomalies
    if (analysis.anomalie && analysis.anomalie.length > 0) {
        analysis.anomalie.forEach(item => {
            items.push({
                id: id++,
                text: item,
                type: 'anomalia',
                confidence: 100,
                source: 'ai_analysis',
                provider: providerName
            });
        });
    }

    // Add patterns
    if (analysis.pattern && analysis.pattern.length > 0) {
        analysis.pattern.forEach(item => {
            items.push({
                id: id++,
                text: item,
                type: 'pattern',
                confidence: 100,
                source: 'ai_analysis',
                provider: providerName
            });
        });
    }

    // Add summary as last item
    if (analysis.riepilogo) {
        items.push({
            id: id++,
            text: analysis.riepilogo,
            type: 'riepilogo',
            confidence: 100,
            source: 'ai_analysis',
            provider: providerName
        });
    }

    return items;
}

function convertSummaryToDownloadFormat(summary, providerName = 'AI') {
    // Convert AI summary object to array format suitable for download
    const items = [];
    let id = 0;

    // Add document type
    if (summary.tipo_documento) {
        items.push({
            id: id++,
            text: summary.tipo_documento,
            type: 'tipo_documento',
            confidence: 100,
            source: 'ai_summary',
            provider: providerName
        });
    }

    // Add purpose
    if (summary.scopo) {
        items.push({
            id: id++,
            text: summary.scopo,
            type: 'scopo',
            confidence: 100,
            source: 'ai_summary',
            provider: providerName
        });
    }

    // Add key information
    if (summary.informazioni_chiave && summary.informazioni_chiave.length > 0) {
        summary.informazioni_chiave.forEach(item => {
            items.push({
                id: id++,
                text: item,
                type: 'informazione_chiave',
                confidence: 100,
                source: 'ai_summary',
                provider: providerName
            });
        });
    }

    // Add relevant numbers
    if (summary.numeri_rilevanti && summary.numeri_rilevanti.length > 0) {
        summary.numeri_rilevanti.forEach(item => {
            items.push({
                id: id++,
                text: item,
                type: 'numero_rilevante',
                confidence: 100,
                source: 'ai_summary',
                provider: providerName
            });
        });
    }

    // Add important dates
    if (summary.date_importanti && summary.date_importanti.length > 0) {
        summary.date_importanti.forEach(item => {
            items.push({
                id: id++,
                text: item,
                type: 'data_importante',
                confidence: 100,
                source: 'ai_summary',
                provider: providerName
            });
        });
    }

    // Add references
    if (summary.riferimenti && summary.riferimenti.length > 0) {
        summary.riferimenti.forEach(item => {
            items.push({
                id: id++,
                text: item,
                type: 'riferimento',
                confidence: 100,
                source: 'ai_summary',
                provider: providerName
            });
        });
    }

    // Add conclusions
    if (summary.conclusioni) {
        items.push({
            id: id++,
            text: summary.conclusioni,
            type: 'conclusioni',
            confidence: 100,
            source: 'ai_summary',
            provider: providerName
        });
    }

    return items;
}

function convertVisionToDownloadFormat(visionText, providerName) {
    // Convert vision analysis text to downloadable format
    const items = [];

    items.push({
        id: 0,
        text: visionText,
        type: 'vision_analysis',
        confidence: 100,
        source: 'ai_vision',
        provider: providerName
    });

    return items;
}

function convertQAToDownloadFormat(question, answer, providerName) {
    // Convert Q&A to downloadable format
    const items = [];

    items.push({
        id: 0,
        text: `DOMANDA: ${question}`,
        type: 'question',
        confidence: 100,
        source: 'ai_qa',
        provider: providerName
    });

    items.push({
        id: 1,
        text: `RISPOSTA: ${answer}`,
        type: 'answer',
        confidence: 100,
        source: 'ai_qa',
        provider: providerName
    });

    return items;
}

function convertPdfplumberToDownloadFormat(data, pageNum, rotation) {
    // Convert PDFPlumber extraction to downloadable format
    const items = [];

    data.forEach((item, index) => {
        items.push({
            id: index,
            text: item.text,
            type: 'pdfplumber_text',
            confidence: 100, // PDFPlumber extracts native text, so 100% confidence
            source: 'pdfplumber',
            page: pageNum,
            rotation: rotation,
            position: {
                x0: item.x0.toFixed(2),
                y0: item.y0.toFixed(2),
                x1: item.x1.toFixed(2),
                y1: item.y1.toFixed(2)
            },
            dimensions: {
                width: item.width.toFixed(2),
                height: item.height.toFixed(2)
            }
        });
    });

    return items;
}

function convertOcrToDownloadFormat(words, fullText, pageNum, psmMode, avgConf) {
    // Convert OCR extraction to downloadable format
    const items = [];

    // Add full text as first item
    items.push({
        id: 0,
        text: fullText,
        type: 'ocr_full_text',
        confidence: parseFloat(avgConf),
        source: 'ocr_standard',
        page: pageNum,
        psm_mode: psmMode,
        word_count: words.length
    });

    // Add individual words with confidence
    words.forEach((word, index) => {
        if (word.text && word.text.trim()) {
            items.push({
                id: index + 1,
                text: word.text,
                type: 'ocr_word',
                confidence: word.conf >= 0 ? word.conf : 0,
                source: 'ocr_standard',
                page: pageNum,
                psm_mode: psmMode
            });
        }
    });

    return items;
}

// ============================================================================
// TEMPLATE-BASED EXCEL/CSV GENERATION
// ============================================================================

let currentTemplate = null;

// Add event listeners for template functionality in DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    const templateInput = document.getElementById('templateInput');
    if (templateInput) {
        templateInput.addEventListener('change', handleTemplateSelect);
    }

    // Load saved templates on page load
    loadTemplatesList();

    // Load saved dimension prompts into template section dropdown
    loadDimensionPromptsForTemplate();

    // Load saved extraction method preferences
    loadExtractionMethodPreferences();

    // Save extraction method preferences on change
    ['methodPdfplumber', 'methodOCR', 'methodAIAnalysis', 'methodAISummary', 'methodAIVision'].forEach(methodId => {
        const checkbox = document.getElementById(methodId);
        if (checkbox) {
            checkbox.addEventListener('change', saveExtractionMethodPreferences);
        }
    });
});

function handleTemplateSelect(event) {
    const file = event.target.files[0];
    const templateStatus = document.getElementById('templateStatus');
    const generateBtn = document.getElementById('generateTemplateBtn');
    const saveBtn = document.getElementById('saveTemplateBtn');

    if (!file) {
        templateStatus.textContent = '';
        generateBtn.disabled = true;
        saveBtn.disabled = true;
        currentTemplate = null;
        return;
    }

    if (!file.name.toLowerCase().endsWith('.txt')) {
        templateStatus.textContent = '⚠️ Il file deve essere .txt';
        generateBtn.disabled = true;
        saveBtn.disabled = true;
        currentTemplate = null;
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        currentTemplate = e.target.result;
        templateStatus.textContent = `✓ Template caricato: ${file.name}`;
        generateBtn.disabled = false;
        saveBtn.disabled = false;

        // Auto-fill template name if empty
        const templateNameInput = document.getElementById('templateNameInput');
        if (!templateNameInput.value) {
            templateNameInput.value = file.name.replace('.txt', '');
        }
    };
    reader.onerror = function() {
        templateStatus.textContent = '❌ Errore lettura file';
        generateBtn.disabled = true;
        saveBtn.disabled = true;
        currentTemplate = null;
    };
    reader.readAsText(file);
}

async function generateFromTemplate() {
    if (!currentTemplate) {
        alert('Carica prima un file template .txt');
        return;
    }

    const templateStatus = document.getElementById('templateStatus');
    const generateBtn = document.getElementById('generateTemplateBtn');
    const progressContainer = document.getElementById('progressContainer');

    generateBtn.disabled = true;
    templateStatus.textContent = '';
    progressContainer.style.display = 'block';

    try {
        // Step 1: Analyze entire PDF with all methods
        await analyzeEntirePDF();

        // Step 2: Check if dimension extraction is requested
        const dimensionPromptSelect = document.getElementById('templateDimensionPromptSelect');
        const dimensionPromptId = dimensionPromptSelect ? dimensionPromptSelect.value : '';

        let dimensionsData = null;
        if (dimensionPromptId) {
            // Check if dimensions are already cached (from previous extraction)
            if (typeof currentExtractedDimensions !== 'undefined' && currentExtractedDimensions) {
                updateProgress(75, 'Riutilizzo dimensioni', 'Uso dimensioni già estratte (nessun token consumato)...');
                console.log('Using cached dimensions, no API call needed');

                // Reuse cached dimensions with provider name
                dimensionsData = {
                    text: currentExtractedDimensions,
                    provider: typeof currentProviderName !== 'undefined' ? currentProviderName : 'AI'
                };
            } else {
                // Extract dimensions using the selected prompt
                updateProgress(75, 'Estrazione dimensioni', 'Analisi dimensioni con AI...');
                dimensionsData = await extractDimensionsForTemplate(dimensionPromptId);
            }
        }

        // Step 3: Collect all extracted data
        updateProgress(80, 'Raccolta dati completa', 'Preparazione generazione file...');
        const allData = await collectAllExtractedData();

        if (!allData) {
            templateStatus.textContent = '❌ Nessun dato disponibile';
            progressContainer.style.display = 'none';
            generateBtn.disabled = false;
            return;
        }

        // Add dimensions data if available
        if (dimensionsData) {
            allData.dimensions = dimensionsData;
        }

        // Step 4: Generate file with current AI provider
        const providerName = document.getElementById('aiProviderSelect')?.selectedOptions[0]?.text || 'AI';
        updateProgress(90, `Elaborazione con ${providerName}`, 'Generazione file Excel...');

        const response = await fetch('/generate_from_template', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                template: currentTemplate,
                data: allData
            })
        });

        if (response.ok) {
            updateProgress(100, 'Completato!', 'Download in corso...');

            // Download the generated file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `template_output_${Date.now()}.xlsx`;
            if (contentDisposition) {
                const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            }

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            templateStatus.textContent = `✓ File generato: ${filename}`;
            status.textContent = `Download completato: ${filename}`;

            setTimeout(() => {
                progressContainer.style.display = 'none';
            }, 2000);
        } else {
            const errorData = await response.json();
            templateStatus.textContent = '❌ Errore generazione';
            alert('Errore: ' + (errorData.error || 'Errore sconosciuto'));
            progressContainer.style.display = 'none';
        }
    } catch (error) {
        templateStatus.textContent = '❌ Errore: ' + error.message;
        alert('Errore: ' + error.message);
        progressContainer.style.display = 'none';
    } finally {
        generateBtn.disabled = false;
    }
}

async function collectAllExtractedData() {
    const data = {
        ocr_numbers: [],
        pdfplumber_text: '',
        ai_analysis: null,
        ai_summary: null
    };

    try {
        // Get OCR results from ocr_results.json (limit to avoid token overflow)
        const ocrResponse = await fetch('/get_extraction_results');
        if (ocrResponse.ok) {
            const ocrData = await ocrResponse.json();
            if (ocrData.success && ocrData.numbers) {
                // Limit OCR numbers to avoid token overflow
                // Group by unique text values to reduce redundancy
                const uniqueNumbers = {};
                ocrData.numbers.forEach(num => {
                    const key = num.text;
                    if (!uniqueNumbers[key]) {
                        uniqueNumbers[key] = num;
                    }
                });
                // Limit to 500 unique numbers maximum
                data.ocr_numbers = Object.values(uniqueNumbers).slice(0, 500);
            }
        }

        // Get PDF text from pdfplumber (limit to avoid token overflow)
        const textResponse = await fetch('/get_pdf_text');
        if (textResponse.ok) {
            const textData = await textResponse.json();
            if (textData.success && textData.text) {
                // Limit text to approximately 100,000 characters (~25,000 tokens)
                const maxChars = 100000;
                if (textData.text.length > maxChars) {
                    data.pdfplumber_text = textData.text.substring(0, maxChars) + '\n\n[... testo troncato per limite token ...]';
                } else {
                    data.pdfplumber_text = textData.text;
                }
            }
        }

        // Get AI analysis and summary if available (these are already concise)
        const aiResponse = await fetch('/get_ai_results');
        if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            if (aiData.success) {
                data.ai_analysis = aiData.analysis;
                data.ai_summary = aiData.summary;
            }
        }

        return data;
    } catch (error) {
        console.error('Error collecting data:', error);
        return null;
    }
}

// ============================================================================
// TEMPLATE LIBRARY MANAGEMENT
// ============================================================================

async function loadTemplatesList() {
    try {
        const response = await fetch('/get_templates');
        if (response.ok) {
            const data = await response.json();
            const select = document.getElementById('savedTemplatesSelect');

            // Clear existing options except first
            select.innerHTML = '<option value="">-- Seleziona un template --</option>';

            // Add templates
            if (data.templates && data.templates.length > 0) {
                data.templates.forEach(template => {
                    const option = document.createElement('option');
                    option.value = template.id;
                    option.textContent = template.name;
                    select.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading templates:', error);
    }
}

async function saveCurrentTemplate() {
    const templateName = document.getElementById('templateNameInput').value.trim();
    const templateStatus = document.getElementById('templateStatus');

    if (!templateName) {
        alert('Inserisci un nome per il template');
        return;
    }

    if (!currentTemplate) {
        alert('Carica prima un template');
        return;
    }

    try {
        templateStatus.textContent = '⏳ Salvataggio in corso...';

        const response = await fetch('/save_template', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                name: templateName,
                content: currentTemplate
            })
        });

        const data = await response.json();

        if (data.success) {
            templateStatus.textContent = `✓ Template "${templateName}" salvato`;

            // Reload templates list
            await loadTemplatesList();

            // Clear file input
            document.getElementById('templateInput').value = '';
        } else {
            templateStatus.textContent = '❌ ' + (data.error || 'Errore salvataggio');
        }
    } catch (error) {
        templateStatus.textContent = '❌ Errore connessione';
        console.error('Error saving template:', error);
    }
}

async function loadSavedTemplate() {
    const select = document.getElementById('savedTemplatesSelect');
    const templateId = select.value;
    const templateStatus = document.getElementById('templateStatus');

    if (!templateId) {
        alert('Seleziona un template dalla lista');
        return;
    }

    try {
        templateStatus.textContent = '⏳ Caricamento...';

        const response = await fetch(`/get_template/${templateId}`);
        const data = await response.json();

        if (data.success) {
            currentTemplate = data.template.content;
            document.getElementById('templateNameInput').value = data.template.name;
            document.getElementById('generateTemplateBtn').disabled = false;
            document.getElementById('saveTemplateBtn').disabled = false;
            templateStatus.textContent = `✓ Template "${data.template.name}" caricato`;
        } else {
            templateStatus.textContent = '❌ ' + (data.error || 'Errore caricamento');
        }
    } catch (error) {
        templateStatus.textContent = '❌ Errore connessione';
        console.error('Error loading template:', error);
    }
}

async function deleteSavedTemplate() {
    const select = document.getElementById('savedTemplatesSelect');
    const templateId = select.value;
    const templateStatus = document.getElementById('templateStatus');

    if (!templateId) {
        alert('Seleziona un template da eliminare');
        return;
    }

    const templateName = select.options[select.selectedIndex].text;

    if (!confirm(`Vuoi eliminare il template "${templateName}"?`)) {
        return;
    }

    try {
        templateStatus.textContent = '⏳ Eliminazione...';

        const response = await fetch(`/delete_template/${templateId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            templateStatus.textContent = `✓ Template "${templateName}" eliminato`;

            // Reload templates list
            await loadTemplatesList();

            // Clear current template if it was the deleted one
            if (document.getElementById('templateNameInput').value === templateName) {
                currentTemplate = null;
                document.getElementById('templateNameInput').value = '';
                document.getElementById('generateTemplateBtn').disabled = true;
                document.getElementById('saveTemplateBtn').disabled = true;
            }
        } else {
            templateStatus.textContent = '❌ ' + (data.error || 'Errore eliminazione');
        }
    } catch (error) {
        templateStatus.textContent = '❌ Errore connessione';
        console.error('Error deleting template:', error);
    }
}

async function downloadTemplate() {
    const select = document.getElementById('savedTemplatesSelect');
    const templateId = select.value;
    const templateStatus = document.getElementById('templateStatus');

    if (!templateId) {
        alert('Seleziona un template da scaricare');
        return;
    }

    try {
        templateStatus.textContent = '⏳ Download...';

        const response = await fetch(`/get_template/${templateId}`);
        const data = await response.json();

        if (data.success) {
            const template = data.template;
            const blob = new Blob([template.content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${template.name}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            templateStatus.textContent = `✓ Download "${template.name}.txt" completato`;
        } else {
            templateStatus.textContent = '❌ ' + (data.error || 'Errore download');
        }
    } catch (error) {
        templateStatus.textContent = '❌ Errore connessione';
        console.error('Error downloading template:', error);
    }
}

// ============================================================================
// COMPLETE PDF ANALYSIS WITH PROGRESS TRACKING
// ============================================================================

let progressStartTime = null;
let totalSteps = 0;
let completedSteps = 0;

function updateProgress(percentage, mainText, detailText = '') {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const progressTime = document.getElementById('progressTime');
    const progressSteps = document.getElementById('progressSteps');

    if (progressBar) progressBar.style.width = percentage + '%';
    if (progressText) progressText.textContent = mainText;
    if (progressSteps) progressSteps.textContent = detailText;

    // Calculate estimated time remaining
    if (progressStartTime && percentage > 0 && percentage < 100) {
        const elapsed = (Date.now() - progressStartTime) / 1000; // seconds
        const estimated = (elapsed / percentage) * (100 - percentage);
        const minutes = Math.floor(estimated / 60);
        const seconds = Math.floor(estimated % 60);

        if (minutes > 0) {
            progressTime.textContent = `Tempo stimato: ${minutes}m ${seconds}s`;
        } else {
            progressTime.textContent = `Tempo stimato: ${seconds}s`;
        }
    } else if (percentage >= 100) {
        const elapsed = (Date.now() - progressStartTime) / 1000;
        progressTime.textContent = `Completato in ${Math.floor(elapsed)}s`;
    }
}

async function analyzeEntirePDF() {
    progressStartTime = Date.now();

    // Get selected extraction methods
    const usePdfplumber = document.getElementById('methodPdfplumber').checked;
    const useOCR = document.getElementById('methodOCR').checked;
    const useAIAnalysis = document.getElementById('methodAIAnalysis').checked;
    const useAISummary = document.getElementById('methodAISummary').checked;
    const useAIVision = document.getElementById('methodAIVision').checked;

    // Validate at least one method is selected
    if (!usePdfplumber && !useOCR && !useAIAnalysis && !useAISummary && !useAIVision) {
        throw new Error('Seleziona almeno un metodo di estrazione');
    }

    try {
        // Get PDF info
        updateProgress(5, 'Caricamento PDF', 'Verifica documento...');
        const infoResponse = await fetch('/get_pdf_info');
        if (!infoResponse.ok) {
            throw new Error('PDF non caricato. Carica prima un PDF.');
        }
        const pdfInfo = await infoResponse.json();
        const pageCount = pdfInfo.page_count;

        // Calculate total steps based on selected methods
        totalSteps = 0;
        if (usePdfplumber) totalSteps += pageCount;
        if (useOCR) totalSteps += pageCount;
        if (useAIAnalysis) totalSteps++;
        if (useAISummary) totalSteps++;
        if (useAIVision) totalSteps++;

        completedSteps = 0;
        let currentProgress = 10;

        // Step 1: Extract with pdfplumber for all pages (if selected)
        if (usePdfplumber) {
            updateProgress(currentProgress, 'Estrazione pdfplumber', `Elaborazione tutte le ${pageCount} pagine...`);
            await fetch('/extract_all_pages_pdfplumber', { method: 'POST' });
            completedSteps += pageCount;
            currentProgress = 10 + (completedSteps / totalSteps) * 60;
            updateProgress(currentProgress, 'PDFplumber completato', `${pageCount} pagine elaborate`);
        }

        // Step 2: Extract with OCR for all pages (if selected)
        if (useOCR) {
            updateProgress(currentProgress, 'Estrazione OCR avanzata', `Analisi ${pageCount} pagine con OCR...`);
            for (let page = 0; page < pageCount; page++) {
                await fetch('/extract_numbers_advanced', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({page_num: page, min_conf: 60})
                });
                completedSteps++;
                currentProgress = 10 + (completedSteps / totalSteps) * 60;
                updateProgress(currentProgress, 'Estrazione OCR avanzata', `Pagina ${page + 1}/${pageCount} completata`);
            }
            updateProgress(currentProgress, 'OCR completato', `${pageCount} pagine analizzate`);
        }

        // Step 3: AI Analysis (if selected)
        if (useAIAnalysis) {
            const providerName = document.getElementById('aiProviderSelect')?.selectedOptions[0]?.text || 'AI';
            updateProgress(currentProgress, 'Analisi AI', `${providerName} sta analizzando i dati...`);
            await fetch('/opus/analyze', { method: 'POST' });
            completedSteps++;
            currentProgress = 10 + (completedSteps / totalSteps) * 60;
        }

        // Step 4: AI Summary (if selected)
        if (useAISummary) {
            updateProgress(currentProgress, 'Riepilogo AI', 'Creazione riepilogo documento...');
            await fetch('/opus/summarize', { method: 'POST' });
            completedSteps++;
            currentProgress = 10 + (completedSteps / totalSteps) * 60;
        }

        // Step 5: Vision Analysis (if selected)
        if (useAIVision && currentPageImage) {
            updateProgress(currentProgress, 'Analisi visione', 'Analisi visuale della prima pagina...');
            await fetch('/opus/vision', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({image: currentPageImage})
            });
            completedSteps++;
            currentProgress = 10 + (completedSteps / totalSteps) * 60;
        }

        updateProgress(75, 'Analisi completa', `${getSelectedMethodsText()} completati`);

    } catch (error) {
        console.error('Error in complete PDF analysis:', error);
        throw error;
    }
}

function getSelectedMethodsText() {
    const methods = [];
    if (document.getElementById('methodPdfplumber').checked) methods.push('PDFplumber');
    if (document.getElementById('methodOCR').checked) methods.push('OCR');
    if (document.getElementById('methodAIAnalysis').checked) methods.push('AI Analysis');
    if (document.getElementById('methodAISummary').checked) methods.push('AI Summary');
    if (document.getElementById('methodAIVision').checked) methods.push('AI Vision');
    return methods.join(', ');
}

// ============================================================================
// EXTRACTION METHOD PREFERENCES
// ============================================================================

function saveExtractionMethodPreferences() {
    const preferences = {
        pdfplumber: document.getElementById('methodPdfplumber').checked,
        ocr: document.getElementById('methodOCR').checked,
        aiAnalysis: document.getElementById('methodAIAnalysis').checked,
        aiSummary: document.getElementById('methodAISummary').checked,
        aiVision: document.getElementById('methodAIVision').checked
    };
    localStorage.setItem('extractionMethodPreferences', JSON.stringify(preferences));
}

function loadExtractionMethodPreferences() {
    try {
        const saved = localStorage.getItem('extractionMethodPreferences');
        if (saved) {
            const preferences = JSON.parse(saved);
            document.getElementById('methodPdfplumber').checked = preferences.pdfplumber !== false;
            document.getElementById('methodOCR').checked = preferences.ocr !== false;
            document.getElementById('methodAIAnalysis').checked = preferences.aiAnalysis !== false;
            document.getElementById('methodAISummary').checked = preferences.aiSummary !== false;
            document.getElementById('methodAIVision').checked = preferences.aiVision !== false;
        }
    } catch (error) {
        console.error('Error loading extraction method preferences:', error);
    }
}

// ============================================================================
// DIMENSION PROMPTS FOR TEMPLATE SECTION
// ============================================================================

async function loadDimensionPromptsForTemplate() {
    try {
        const response = await fetch('/get_dimension_prompts');
        if (response.ok) {
            const data = await response.json();
            const select = document.getElementById('templateDimensionPromptSelect');

            if (!select) return;

            // Clear existing options except first
            select.innerHTML = '<option value="">-- Nessuna estrazione dimensioni --</option>';

            // Add prompts
            if (data.prompts && data.prompts.length > 0) {
                data.prompts.forEach(prompt => {
                    const option = document.createElement('option');
                    option.value = prompt.id;
                    option.textContent = prompt.name;
                    select.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading dimension prompts for template:', error);
    }
}

async function extractDimensionsForTemplate(dimensionPromptId) {
    try {
        // First, get the dimension prompt content
        const promptResponse = await fetch(`/get_dimension_prompt/${dimensionPromptId}`);
        const promptData = await promptResponse.json();

        if (!promptData.success || !promptData.prompt) {
            console.error('Failed to load dimension prompt');
            return null;
        }

        const dimensionPrompt = promptData.prompt.content;

        // Check if we have a current page image
        if (!currentPageImage) {
            console.error('No page image available for dimension extraction');
            return null;
        }

        // Collect additional context data from PDF
        const contextData = {
            pdfplumber_text: '',
            ai_analysis: null,
            ai_summary: null
        };

        // Get PDF text from pdfplumber
        try {
            const textResponse = await fetch('/get_pdf_text');
            if (textResponse.ok) {
                const textData = await textResponse.json();
                if (textData.success && textData.text) {
                    // Limit text to 50,000 characters for context
                    const maxChars = 50000;
                    contextData.pdfplumber_text = textData.text.length > maxChars
                        ? textData.text.substring(0, maxChars) + '\n\n[... testo troncato ...]'
                        : textData.text;
                }
            }
        } catch (error) {
            console.warn('Could not fetch PDF text:', error);
        }

        // Get AI analysis and summary if available
        try {
            const aiResponse = await fetch('/get_ai_results');
            if (aiResponse.ok) {
                const aiData = await aiResponse.json();
                if (aiData.success) {
                    contextData.ai_analysis = aiData.analysis;
                    contextData.ai_summary = aiData.summary;
                }
            }
        } catch (error) {
            console.warn('Could not fetch AI results:', error);
        }

        // Extract dimensions using the prompt with context data
        const extractResponse = await fetch('/extract_dimensions_with_context', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                prompt: dimensionPrompt,
                image: currentPageImage,
                context: contextData
            })
        });

        const extractData = await extractResponse.json();

        if (extractData.success && extractData.dimensions) {
            // Return both dimensions and provider name
            return {
                text: extractData.dimensions,
                provider: extractData.provider
            };
        } else {
            console.error('Failed to extract dimensions:', extractData.error);
            return null;
        }
    } catch (error) {
        console.error('Error in extractDimensionsForTemplate:', error);
        return null;
    }
}

// ============================================================================
// AI PROVIDER SELECTION
// ============================================================================

async function loadAIProviders() {
    try {
        const response = await fetch('/ai/providers');
        if (response.ok) {
            const data = await response.json();
            const select = document.getElementById('aiProviderSelect');

            if (!select) return;

            // Clear and populate
            select.innerHTML = '';

            if (Object.keys(data.providers).length === 0) {
                select.innerHTML = '<option value="">Nessun provider disponibile</option>';
                select.disabled = true;
                return;
            }

            // Add providers
            for (const [key, name] of Object.entries(data.providers)) {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = name;
                if (key === data.current) {
                    option.selected = true;
                }
                select.appendChild(option);
            }

            select.disabled = false;
        }
    } catch (error) {
        console.error('Error loading AI providers:', error);
    }
}

async function switchAIProvider() {
    const select = document.getElementById('aiProviderSelect');
    const providerKey = select.value;

    if (!providerKey) return;

    try {
        const response = await fetch('/ai/provider/set', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({provider: providerKey})
        });

        const data = await response.json();

        if (data.success) {
            // Update status display
            checkAIStatus();
            status.textContent = `Provider cambiato: ${data.provider_name}`;
            // Update button visibility based on capabilities
            if (data.capabilities) {
                updateButtonsBasedOnCapabilities(data.capabilities);
            }
            // Update ask button text with current provider name
            const askBtnText = document.getElementById('askBtnText');
            if (askBtnText) {
                askBtnText.textContent = `Chiedi a ${data.provider_name}`;
            }
        }
    } catch (error) {
        console.error('Error switching AI provider:', error);
    }
}

async function checkAIStatus() {
    try {
        const response = await fetch('/ai/status');
        const data = await response.json();

        if (data.enabled) {
            opusStatus.style.backgroundColor = '#d4edda';
            opusStatus.style.color = '#155724';
            opusStatus.innerHTML = `<strong>✓</strong> ${data.message}`;
            // Update button visibility based on capabilities
            if (data.capabilities) {
                updateButtonsBasedOnCapabilities(data.capabilities);
            }
            // Update ask button text with current provider name
            const askBtnText = document.getElementById('askBtnText');
            if (askBtnText && data.provider_name) {
                askBtnText.textContent = `Chiedi a ${data.provider_name}`;
            }
        } else {
            opusStatus.style.backgroundColor = '#fff3cd';
            opusStatus.style.color = '#856404';
            opusStatus.innerHTML = `<strong>⚠</strong> ${data.message}`;
            // Disable all AI buttons if no provider is available
            updateButtonsBasedOnCapabilities({
                text_analysis: false,
                vision_analysis: false,
                chat: false,
                dimension_extraction: false
            });
        }
    } catch (error) {
        opusStatus.style.backgroundColor = '#f8d7da';
        opusStatus.style.color = '#721c24';
        opusStatus.textContent = 'Errore controllo AI';
        // Disable all AI buttons on error
        updateButtonsBasedOnCapabilities({
            text_analysis: false,
            vision_analysis: false,
            chat: false,
            dimension_extraction: false
        });
    }
}

function updateButtonsBasedOnCapabilities(capabilities) {
    // Update AI Analysis buttons based on provider capabilities
    const analyzeBtn = document.getElementById('analyzeBtn');
    const visionBtn = document.getElementById('visionBtn');
    const askBtn = document.getElementById('askBtn');
    const summarizeBtn = document.getElementById('summarizeBtn');

    // Text analysis capability (for analyze and summarize)
    if (analyzeBtn && summarizeBtn) {
        const textEnabled = capabilities.text_analysis === true;
        analyzeBtn.disabled = !textEnabled;
        summarizeBtn.disabled = !textEnabled;

        // Add visual indicator for disabled state
        if (!textEnabled) {
            analyzeBtn.title = 'Il provider AI corrente non supporta l\'analisi testuale';
            summarizeBtn.title = 'Il provider AI corrente non supporta l\'analisi testuale';
        } else {
            analyzeBtn.title = '';
            summarizeBtn.title = '';
        }
    }

    // Vision analysis capability
    if (visionBtn) {
        const visionEnabled = capabilities.vision_analysis === true;
        visionBtn.disabled = !visionEnabled;

        if (!visionEnabled) {
            visionBtn.title = 'Il provider AI corrente non supporta l\'analisi visiva';
        } else {
            visionBtn.title = '';
        }
    }

    // Chat capability (for ask button)
    if (askBtn) {
        const chatEnabled = capabilities.chat === true;
        askBtn.disabled = !chatEnabled;

        if (!chatEnabled) {
            askBtn.title = 'Il provider AI corrente non supporta la chat';
        } else {
            askBtn.title = '';
        }
    }

    // Update extraction method checkboxes based on capabilities
    const methodAIAnalysis = document.getElementById('methodAIAnalysis');
    const methodAISummary = document.getElementById('methodAISummary');
    const methodAIVision = document.getElementById('methodAIVision');

    if (methodAIAnalysis && methodAISummary) {
        const textEnabled = capabilities.text_analysis === true;
        methodAIAnalysis.disabled = !textEnabled;
        methodAISummary.disabled = !textEnabled;

        if (!textEnabled) {
            methodAIAnalysis.checked = false;
            methodAISummary.checked = false;
            const analysisLabel = document.querySelector('label[for="methodAIAnalysis"]');
            const summaryLabel = document.querySelector('label[for="methodAISummary"]');
            if (analysisLabel) analysisLabel.style.opacity = '0.5';
            if (summaryLabel) summaryLabel.style.opacity = '0.5';
        } else {
            const analysisLabel = document.querySelector('label[for="methodAIAnalysis"]');
            const summaryLabel = document.querySelector('label[for="methodAISummary"]');
            if (analysisLabel) analysisLabel.style.opacity = '1';
            if (summaryLabel) summaryLabel.style.opacity = '1';
        }
    }

    if (methodAIVision) {
        const visionEnabled = capabilities.vision_analysis === true;
        methodAIVision.disabled = !visionEnabled;

        if (!visionEnabled) {
            methodAIVision.checked = false;
            const visionLabel = document.querySelector('label[for="methodAIVision"]');
            if (visionLabel) visionLabel.style.opacity = '0.5';
        } else {
            const visionLabel = document.querySelector('label[for="methodAIVision"]');
            if (visionLabel) visionLabel.style.opacity = '1';
        }
    }
}


