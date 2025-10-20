// Global state
let currentZoom = 100;
let currentHighlightedNumbers = [];
let currentNumbers = [];
let currentPageCount = 1;
let currentPage = 0;
let currentMode = 'numbers'; // 'numbers', 'pdfplumber', 'ocr', 'ai'
let currentPageImage = null; // Store current page image for AI vision

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

    // Check Opus status on load
    checkOpusStatus();

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

            // Enable AI controls if Opus is available
            checkOpusStatus().then(() => {
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
// AI ANALYSIS FUNCTIONS (OPUS INTEGRATION)
// ============================================================================

async function checkOpusStatus() {
    try {
        const response = await fetch('/opus/status');
        const data = await response.json();

        if (data.enabled) {
            opusStatus.style.backgroundColor = '#d4edda';
            opusStatus.style.color = '#155724';
            opusStatus.innerHTML = '<strong>✓</strong> ' + data.message;
        } else {
            opusStatus.style.backgroundColor = '#fff3cd';
            opusStatus.style.color = '#856404';
            opusStatus.innerHTML = '<strong>⚠</strong> ' + data.message;
        }
    } catch (error) {
        opusStatus.style.backgroundColor = '#f8d7da';
        opusStatus.style.color = '#721c24';
        opusStatus.textContent = 'Errore controllo Opus';
    }
}

async function handleAnalyze() {
    textList.innerHTML = '<div class="ai-loading">🤖 Analisi in corso con Claude Opus...</div>';
    analyzeBtn.disabled = true;
    status.textContent = 'Analisi AI in corso...';

    try {
        const response = await fetch('/opus/analyze', { method: 'POST' });
        const data = await response.json();

        if (data.error) {
            textList.innerHTML = `<div class="ai-error"><strong>Errore:</strong> ${data.error}</div>`;
            status.textContent = 'Errore analisi AI';
        } else if (data.success && data.analysis) {
            displayAnalysisResults(data.analysis);
            status.textContent = 'Analisi AI completata';
        }
    } catch (error) {
        textList.innerHTML = `<div class="ai-error"><strong>Errore:</strong> ${error.message}</div>`;
        status.textContent = 'Errore connessione AI';
    } finally {
        analyzeBtn.disabled = false;
    }
}

async function handleVision() {
    if (!currentPageImage) {
        status.textContent = 'Carica prima un PDF';
        return;
    }

    textList.innerHTML = '<div class="ai-loading">👁️ Analisi visione in corso con Claude Opus...</div>';
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
        } else if (data.success && data.vision_analysis) {
            textList.innerHTML = `
                <div class="ai-result">
                    <h3>🔍 Analisi Visione Claude Opus</h3>
                    <div class="ai-result-item">
                        <pre>${escapeHtml(data.vision_analysis)}</pre>
                    </div>
                </div>
            `;
            status.textContent = 'Analisi visione AI completata';
        }
    } catch (error) {
        textList.innerHTML = `<div class="ai-error"><strong>Errore:</strong> ${error.message}</div>`;
        status.textContent = 'Errore connessione AI';
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

    textList.innerHTML = '<div class="ai-loading">💬 Claude Opus sta pensando...</div>';
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
        } else if (data.success && data.answer) {
            textList.innerHTML = `
                <div class="ai-result">
                    <h3>❓ Domanda</h3>
                    <div class="ai-result-item">
                        <strong>${escapeHtml(question)}</strong>
                    </div>
                    <h3 style="margin-top: 15px;">💡 Risposta Claude Opus</h3>
                    <div class="ai-result-item">
                        <pre>${escapeHtml(data.answer)}</pre>
                    </div>
                </div>
            `;
            status.textContent = 'Risposta ricevuta';
        }
    } catch (error) {
        textList.innerHTML = `<div class="ai-error"><strong>Errore:</strong> ${error.message}</div>`;
        status.textContent = 'Errore connessione AI';
    } finally {
        askBtn.disabled = false;
    }
}

async function handleSummarize() {
    textList.innerHTML = '<div class="ai-loading">📝 Creazione riepilogo con Claude Opus...</div>';
    summarizeBtn.disabled = true;
    status.textContent = 'Creazione riepilogo AI...';

    try {
        const response = await fetch('/opus/summarize', { method: 'POST' });
        const data = await response.json();

        if (data.error) {
            textList.innerHTML = `<div class="ai-error"><strong>Errore:</strong> ${data.error}</div>`;
            status.textContent = 'Errore riepilogo AI';
        } else if (data.success && data.summary) {
            displaySummaryResults(data.summary);
            status.textContent = 'Riepilogo AI completato';
        }
    } catch (error) {
        textList.innerHTML = `<div class="ai-error"><strong>Errore:</strong> ${error.message}</div>`;
        status.textContent = 'Errore connessione AI';
    } finally {
        summarizeBtn.disabled = false;
    }
}

function displayAnalysisResults(analysis) {
    let html = '<div class="ai-result"><h3>🔬 Analisi Intelligente Claude Opus</h3>';

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

function displaySummaryResults(summary) {
    let html = '<div class="ai-result"><h3>📄 Riepilogo Documento Claude Opus</h3>';

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

function downloadResults(format) {
    window.location.href = `/download_results/${format}`;
}
