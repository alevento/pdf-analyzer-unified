let allRotations = [];
let currentRotationIndex = 0;
let currentZoom = 100;
let currentHighlightedNumbers = [];

document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');

    uploadBtn.addEventListener('click', uploadFile);

    fileInput.addEventListener('change', function() {
        const fileName = document.getElementById('fileName');
        if (fileInput.files.length > 0) {
            uploadBtn.disabled = false;
            fileName.textContent = 'File selezionato: ' + fileInput.files[0].name;
            fileName.style.display = 'inline';
        } else {
            fileName.style.display = 'none';
        }
    });

    // Zoom controls
    document.getElementById('zoomIn').addEventListener('click', () => zoomImage(25));
    document.getElementById('zoomOut').addEventListener('click', () => zoomImage(-25));
    document.getElementById('zoomReset').addEventListener('click', () => setZoom(100));
});

async function uploadFile() {
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const status = document.getElementById('status');
    const imageContainer = document.getElementById('imageContainer');
    const textList = document.getElementById('textList');

    if (!fileInput.files || fileInput.files.length === 0) {
        status.textContent = 'Seleziona un file PDF';
        return;
    }

    const file = fileInput.files[0];

    if (!file.name.toLowerCase().endsWith('.pdf')) {
        status.textContent = 'Errore: Il file deve essere un PDF';
        return;
    }

    // Leggi la soglia di confidenza
    const confidenceThreshold = document.getElementById('confidenceThreshold').value;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('confidence_threshold', confidenceThreshold);

    uploadBtn.disabled = true;
    status.textContent = `Elaborazione in corso (soglia ${confidenceThreshold}%)...`;
    imageContainer.innerHTML = '<p class="loading">Analisi del documento con OCR...</p>';
    textList.innerHTML = '<p class="loading">Estrazione dei numeri...</p>';

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            allRotations = data.rotations;
            currentRotationIndex = 0;

            // Mostra le tab di rotazione
            displayRotationTabs();

            // Mostra la prima rotazione
            displayRotation(0);

            status.textContent = `Completato! Elaborazione con ${allRotations.length} rotazioni.`;
        } else {
            status.textContent = 'Errore: ' + (data.error || 'Errore sconosciuto');
            imageContainer.innerHTML = '<p class="placeholder">Errore durante l\'elaborazione</p>';
            textList.innerHTML = '<p class="placeholder">Errore durante l\'estrazione dei numeri</p>';
        }
    } catch (error) {
        status.textContent = 'Errore di connessione: ' + error.message;
        imageContainer.innerHTML = '<p class="placeholder">Errore durante l\'elaborazione</p>';
        textList.innerHTML = '<p class="placeholder">Errore durante l\'estrazione dei numeri</p>';
    } finally {
        uploadBtn.disabled = false;
    }
}

function displayRotationTabs() {
    const rotationTabs = document.getElementById('rotationTabs');
    rotationTabs.innerHTML = '';
    rotationTabs.style.display = 'flex';

    allRotations.forEach((rotation, index) => {
        const tab = document.createElement('button');
        tab.className = 'rotation-tab';
        if (index === currentRotationIndex) {
            tab.classList.add('active');
        }
        tab.textContent = `${rotation.label} (${rotation.count})`;
        tab.addEventListener('click', () => switchRotation(index));
        rotationTabs.appendChild(tab);
    });
}

function switchRotation(index) {
    currentRotationIndex = index;

    // Aggiorna le tab
    const tabs = document.querySelectorAll('.rotation-tab');
    tabs.forEach((tab, i) => {
        if (i === index) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Mostra la rotazione selezionata
    displayRotation(index);
}

function displayRotation(index) {
    const rotation = allRotations[index];

    // Mostra l'immagine
    displayImage(rotation.image);

    // Mostra i numeri estratti
    displayNumbersList(rotation.numbers);

    // Aggiorna il conteggio
    const numberCount = document.getElementById('numberCount');
    numberCount.textContent = `Trovati ${rotation.count} numeri con ${rotation.label}`;
    numberCount.style.display = 'block';
}

function displayImage(imageBase64) {
    const imageContainer = document.getElementById('imageContainer');
    const zoomControls = document.getElementById('zoomControls');

    imageContainer.innerHTML = '';

    const img = document.createElement('img');
    img.src = imageBase64;
    img.id = 'mainImage';

    // Aggiungi event listener per il click sull'immagine
    img.addEventListener('click', handleImageClick);

    imageContainer.appendChild(img);

    // Mostra i controlli di zoom
    zoomControls.style.display = 'flex';

    // Applica lo zoom corrente
    applyZoom();
}

function handleImageClick(event) {
    const img = event.target;
    const rect = img.getBoundingClientRect();

    // Calcola le coordinate del click relative all'immagine
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Scala le coordinate in base alle dimensioni reali dell'immagine
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;

    const actualX = x * scaleX;
    const actualY = y * scaleY;

    // Trova il numero corrispondente al click
    const rotation = allRotations[currentRotationIndex];
    if (!rotation) return;

    const clickedNumber = findNumberAtPosition(actualX, actualY, rotation.numbers);

    if (clickedNumber) {
        // Evidenzia il numero trovato
        highlightNumber(clickedNumber.id || 0);
    }
}

function findNumberAtPosition(x, y, numbers) {
    // Cerca il numero più piccolo che contiene il punto cliccato
    // (per gestire sovrapposizioni, prendiamo il più piccolo)
    let foundNumbers = [];

    for (const number of numbers) {
        const bbox = number.bbox;

        if (x >= bbox.x && x <= bbox.x + bbox.width &&
            y >= bbox.y && y <= bbox.y + bbox.height) {
            foundNumbers.push({
                number: number,
                area: bbox.width * bbox.height
            });
        }
    }

    // Ordina per area crescente e prendi il più piccolo
    if (foundNumbers.length > 0) {
        foundNumbers.sort((a, b) => a.area - b.area);
        return foundNumbers[0].number;
    }

    return null;
}

function displayNumbersList(numbers) {
    const textList = document.getElementById('textList');
    textList.innerHTML = '';

    if (numbers.length === 0) {
        textList.innerHTML = '<p class="placeholder">Nessun numero trovato</p>';
        return;
    }

    // Raggruppa i numeri per valore
    const groupedNumbers = {};
    numbers.forEach((result) => {
        const key = result.text.trim().toLowerCase();
        if (!groupedNumbers[key]) {
            groupedNumbers[key] = {
                text: result.text,
                occurrences: [],
                maxConfidence: result.confidence
            };
        }
        groupedNumbers[key].occurrences.push(result);
        groupedNumbers[key].maxConfidence = Math.max(groupedNumbers[key].maxConfidence, result.confidence);
    });

    // Converti in array e ordina
    const sortedGroups = Object.values(groupedNumbers).sort((a, b) => {
        // Estrai i numeri per ordinamento numerico
        const numA = parseFloat(a.text.replace(/[^\d.-]/g, '')) || 0;
        const numB = parseFloat(b.text.replace(/[^\d.-]/g, '')) || 0;

        if (numA !== numB) {
            return numA - numB;
        }
        // Se i numeri sono uguali, ordina alfabeticamente
        return a.text.localeCompare(b.text);
    });

    // Crea gli elementi della lista
    sortedGroups.forEach((group) => {
        const item = document.createElement('div');
        item.className = 'text-item';
        // Usa l'ID del primo elemento del gruppo
        item.dataset.id = group.occurrences[0].id || 0;

        const textContent = document.createElement('span');
        textContent.className = 'text-content';
        textContent.textContent = group.text;

        const infoContainer = document.createElement('div');
        infoContainer.className = 'text-info';

        // Mostra il conteggio se ci sono più occorrenze
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

        item.appendChild(textContent);
        item.appendChild(infoContainer);

        // Aggiungi evento click per evidenziare - usa il primo ID del gruppo
        item.addEventListener('click', () => highlightNumber(group.occurrences[0].id || 0));

        textList.appendChild(item);
    });
}

async function highlightNumber(numberId) {
    const rotation = allRotations[currentRotationIndex];

    // Rimuovi highlight da tutti gli elementi
    document.querySelectorAll('.text-item').forEach(item => {
        item.classList.remove('highlighted');
    });

    // Trova il numero selezionato
    const selectedNumber = rotation.numbers.find(n => (n.id || 0) === numberId);
    if (!selectedNumber) return;

    // Trova tutti i numeri con lo stesso valore
    const sameValueNumbers = rotation.numbers.filter(n =>
        n.text.trim().toLowerCase() === selectedNumber.text.trim().toLowerCase()
    );

    // Salva i numeri evidenziati correnti
    currentHighlightedNumbers = sameValueNumbers;

    // Evidenzia tutti gli elementi nella lista con lo stesso valore
    sameValueNumbers.forEach(num => {
        const item = document.querySelector(`.text-item[data-id="${num.id || 0}"]`);
        if (item) {
            item.classList.add('highlighted');
        }
    });

    // Scrolla all'elemento cliccato
    const clickedItem = document.querySelector(`.text-item[data-id="${numberId}"]`);
    if (clickedItem) {
        clickedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Aggiorna il testo selezionato con il conteggio
    const count = sameValueNumbers.length;
    const countText = count > 1 ? ` (${count} occorrenze)` : '';
    document.getElementById('selectedText').textContent = selectedNumber.text + countText;

    // Aggiungi overlay lampeggianti per tutti i numeri con lo stesso valore
    addMultipleHighlightOverlays(sameValueNumbers);

    // Richiedi l'immagine con l'elemento evidenziato al backend
    try {
        const response = await fetch(`/highlight/${numberId}/${currentRotationIndex}`);
        const data = await response.json();

        if (data.success) {
            // Aggiorna solo l'immagine senza cambiare la tab
            updateImageOnly(data.image);

            // Ri-aggiungi gli overlay dopo aver caricato l'immagine
            setTimeout(() => {
                addMultipleHighlightOverlays(sameValueNumbers);
            }, 100);
        }
    } catch (error) {
        console.error('Errore evidenziazione:', error);
    }
}

function updateImageOnly(imageBase64) {
    // Aggiorna solo l'immagine senza resettare zoom o altri stati
    const img = document.getElementById('mainImage');
    if (img) {
        img.src = imageBase64;
    }
}

function addMultipleHighlightOverlays(numbers) {
    // Rimuovi overlay esistenti
    document.querySelectorAll('.highlight-overlay').forEach(el => el.remove());

    const img = document.getElementById('mainImage');
    const imageContainer = document.getElementById('imageContainer');

    if (!img || !numbers || numbers.length === 0) return;

    // Aspetta che l'immagine sia caricata
    if (!img.complete) {
        img.onload = () => addMultipleHighlightOverlays(numbers);
        return;
    }

    // Calcola le proporzioni tra dimensione naturale e visualizzata
    const scaleX = img.width / img.naturalWidth;
    const scaleY = img.height / img.naturalHeight;

    // Ottieni la posizione dell'immagine rispetto al container
    const imgRect = img.getBoundingClientRect();
    const containerRect = imageContainer.getBoundingClientRect();

    const offsetX = imgRect.left - containerRect.left + imageContainer.scrollLeft;
    const offsetY = imgRect.top - containerRect.top + imageContainer.scrollTop;

    let firstOverlay = null;

    // Crea un overlay per ogni numero con lo stesso valore
    numbers.forEach((number, index) => {
        const bbox = number.bbox;

        // Calcola posizione e dimensione dell'overlay
        const x = bbox.x * scaleX;
        const y = bbox.y * scaleY;
        const w = bbox.width * scaleX;
        const h = bbox.height * scaleY;

        // Crea l'overlay
        const overlay = document.createElement('div');
        overlay.className = 'highlight-overlay';
        overlay.style.left = (offsetX + x) + 'px';
        overlay.style.top = (offsetY + y) + 'px';
        overlay.style.width = w + 'px';
        overlay.style.height = h + 'px';

        // Aggiungi un leggero ritardo all'animazione per effetto "onda"
        overlay.style.animationDelay = (index * 0.1) + 's';

        imageContainer.appendChild(overlay);

        if (index === 0) {
            firstOverlay = overlay;
        }
    });

    // Scrolla per rendere visibile il primo overlay
    if (firstOverlay) {
        const overlayRect = firstOverlay.getBoundingClientRect();
        if (overlayRect.top < containerRect.top || overlayRect.bottom > containerRect.bottom ||
            overlayRect.left < containerRect.left || overlayRect.right > containerRect.right) {

            firstOverlay.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    }
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

        // Riposiziona gli overlay lampeggianti dopo lo zoom
        if (currentHighlightedNumbers.length > 0) {
            // Aspetta che l'immagine si ridimensioni
            setTimeout(() => {
                addMultipleHighlightOverlays(currentHighlightedNumbers);

                // Centra la vista sul primo overlay
                const firstOverlay = document.querySelector('.highlight-overlay');
                if (firstOverlay) {
                    firstOverlay.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                }
            }, 50);
        }
    }
}
