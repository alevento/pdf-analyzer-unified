# Changelog - Analizzatore OCR per Disegni Tecnici


## v0.18 (2025-10-22)
### Modifiche
Download universale per tutti i tipi di estrazione (PDFPlumber, OCR, AI)

---


## v0.17 (2025-10-22)
### Modifiche
Sistema di versioning automatico con commit GitHub integrato

---

## v0.15 (2025-10-21)
### Fix
- **Fix modello Novita AI Vision**: Risolto errore 404 per modello vision non disponibile
- Aggiornato da `qwen/qwen-vl-plus` a `meta-llama/llama-3.2-90b-vision-instruct`
- Nome provider aggiornato da "Qwen VL (Novita AI)" a "Llama 3.2 Vision (Novita AI)"

### Dettagli tecnici
- Il modello `qwen/qwen-vl-plus` non è disponibile su Novita AI
- Utilizzato modello Llama 3.2 90B Vision per analisi visione
- Analisi vision ora funzionante con Novita AI

### File modificati
- `ai_providers.py`: Aggiornato NovitaAIProvider.analyze_vision() e get_name()

---

## v0.14 (2025-10-21)
### Modifiche
- **Intestazioni dinamiche AI**: Nome provider AI visualizzato correttamente nei titoli dei risultati
- Funzione `displayAnalysisResults()` ora accetta parametro `providerName`
- Funzione `displaySummaryResults()` ora accetta parametro `providerName`
- Aggiornate funzioni di conversione per includere metadata provider
- Messaggi di caricamento aggiornati per `handleSummarize()`

### Miglioramenti UX
- I titoli "Analisi Intelligente" e "Riepilogo Documento" mostrano il provider utilizzato (Claude Opus 4, GPT-4 Turbo, Gemini 2.5 Pro, Qwen VL)
- Coerenza visiva tra tutte le funzioni AI (Analysis, Summary, Vision, Q&A)
- Metadata provider inclusi nei download per tracciabilità completa

### File modificati
- `static/unified.js`: Aggiornate funzioni display e conversione con parametro providerName

---

## v0.13 (2025-10-21)
### Modifiche
- **Download universale per tutti i risultati AI**: Abilitato download CSV/Excel/JSON per Vision e Q&A
- Aggiunta funzione `convertVisionToDownloadFormat()` per analisi visione
- Aggiunta funzione `convertQAToDownloadFormat()` per domande e risposte
- Visualizzazione provider AI corrente nei messaggi di caricamento Vision e Q&A
- Pulsanti download ora visibili per tutti i tipi di analisi AI

### Nuove funzionalità
- Download risultati analisi visione in formato CSV/Excel/JSON
- Download risposte Q&A con domanda e risposta in formato strutturato
- Metadati provider AI inclusi nei download per tracciabilità

### File modificati
- `static/unified.js`: Aggiunte funzioni di conversione e abilitato download per Vision e Q&A

---

## v0.12 (2025-10-21)
### Modifiche
- **Integrazione Multi-Provider AI**: Supporto per Claude, OpenAI, Gemini e Novita AI
- Sistema di capabilities per abilitare/disabilitare funzionalità in base al provider selezionato
- Aggiornamento dinamico UI quando si cambia provider AI
- Tutte le funzioni di analisi ora utilizzano il provider selezionato dall'utente
- Script di test per validare tutte le API keys configurate (`test_all_providers.py`)
- Aggiornato Gemini a versione 2.5 Pro (da 1.5 Pro)
- Fix f-string formatting nel prompt di analisi

### Nuove funzionalità
- Dropdown per selezione provider AI in tempo reale
- Funzione `updateButtonsBasedOnCapabilities()` per gestione UI dinamica
- Metodo `get_capabilities()` per ogni provider AI
- Visualizzazione provider corrente nei messaggi di caricamento

### File modificati
- `ai_providers.py`: Aggiunti metodi get_capabilities() per tutti i provider
- `unified_app.py`: Refactoring funzioni AI per usare provider manager
- `static/unified.js`: Gestione dinamica UI basata su capabilities
- `test_all_providers.py`: Nuovo file per testing API keys

### File nuovi
- `test_all_providers.py`: Script completo per testare tutte le API keys
- `list_gemini_models.py`: Tool per enumerare modelli Gemini disponibili

---

## v0.11 (2025-10-14)
### Modifiche
- **Filtro densità testo per 90°**: Eliminati rettangoli fucsia in aree con alta densità di testo
- Funzione `calculate_text_density_around()` per analizzare il contesto circostante
- Soglia densità: max 8 elementi entro raggio 2.5x dimensione bbox
- OCR completo su immagine ruotata per rilevare tutti gli elementi (non solo numeri)
- Filtraggio applicato prima della trasformazione coordinate
- Log dettagliato degli elementi rimossi

### File modificati
- `app.py`: Aggiunte funzioni calculate_text_density_around() e filtro in extract_text_with_boxes()

---

## v0.10 (2025-10-14)
### Modifiche
- **Fix coordinate rettangoli fucsia**: Corretta formula trasformazione coordinate da 90° a 0°
- Formula corretta: x_orig = y_rot, y_orig = original_height - x_rot - w_rot
- Rettangoli fucsia ora centrati correttamente sulla vista unificata

### File modificati
- `app.py`: Corretta funzione transform_bbox_from_90_to_0()

---

## v0.9 (2025-10-14)
### Modifiche
- **Vista unificata 0° + 90°**: Integrazione di entrambe le scansioni in un'unica preview
- Trasformazione coordinate da 90° a 0° con funzione transform_bbox_from_90_to_0()
- Rettangoli blu (#0066FF) per numeri orizzontali (0°)
- Rettangoli fucsia (#FF00FF) per numeri verticali rilevati a 90°
- Lista unificata con tutti i numeri trovati
- Marker 'source' per tracciare provenienza ('0deg' o '90deg')

### File modificati
- `app.py`: Funzioni transform_bbox_from_90_to_0(), draw_unified_boxes(), modificata extract_text_with_boxes()
- `templates/index.html`: Rimosso sistema tab, vista singola unificata
- `static/script.js`: Semplificata gestione vista unificata

---

## v0.8 (2025-10-14)
### Modifiche
- **Fix evidenziazione con rotazioni**: Risolto problema del cambio automatico di tab quando si clicca su un numero nella tab 90 gradi
- Salvataggio di immagini separate per ogni rotazione (original_0.png, original_90.png)
- Funzione `updateImageOnly()` nel frontend per aggiornare solo l'immagine senza cambiare tab
- Backend `/highlight` carica l'immagine corretta in base all'angolo della rotazione

### File modificati
- `app.py`: Salvataggio immagini multiple, caricamento immagine corretta in highlight_item()
- `static/script.js`: Aggiunta funzione updateImageOnly() per mantenere la tab attiva

---

## v0.7 (2025-10-14)
### Modifiche
- **Fix encoding**: Risolto errore UnicodeEncodeError sostituendo caratteri Unicode con ASCII
- Cambiato "90° (Verticale→Orizzontale)" in "90 gradi (Verticale->Orizzontale)"

### File modificati
- `app.py`: Label rotazioni con caratteri ASCII

---

## v0.6 (2025-10-14)
### Funzionalità
- **Scansione a doppia rotazione**: Implementata elaborazione a 0° e 90°
- Due tab separate per visualizzare numeri orizzontali (0°) e verticali ruotati (90°)
- Ogni tab ha la propria immagine e lista di numeri

### File modificati
- `app.py`: Funzioni process_single_rotation() e extract_text_with_boxes() per gestire rotazioni multiple

---

## v0.5 (2025-10-14)
### Funzionalità
- **Filtro testo verticale**: Solo testo orizzontale viene rilevato ed evidenziato
- Funzione is_horizontal_text() per analizzare rapporto larghezza/altezza del bounding box

### File modificati
- `app.py`: Aggiunta funzione is_horizontal_text() e filtro in extract_text_with_boxes()

---

## v0.4 (2025-10-14)
### Funzionalità
- **Merge pattern con spazi**: Pattern "numero x numero" con spazi intermedi vengono unificati
- Ricerca fino a 5 elementi avanti per trovare il pattern completo
- Distanza massima aumentata a 100 pixel

### File modificati
- `app.py`: Funzione merge_number_x_number() migliorata per gestire spazi

---

## v0.3 (2025-10-14)
### Funzionalità
- **Unione pattern "NxN"**: Numeri separati da 'x' vengono unificati (es: "25", "x", "30" → "25x30")
- Verifica vicinanza e allineamento sulla stessa linea
- Bounding box unificato per il pattern completo

### File modificati
- `app.py`: Aggiunta funzione merge_number_x_number()

---

## v0.2 (2025-10-14)
### Funzionalità
- **Indicatore di versione**: Badge versione in alto a destra nell'header
- Sistema di incremento automatico versione

### File modificati
- `templates/index.html`: Aggiunta header-top con version-badge
- `static/style.css`: Stili per version-badge

---

## v0.1 (2025-10-14)
### Funzionalità iniziali
- Caricamento PDF e conversione in immagine
- OCR con Tesseract (3 configurazioni PSM: 3, 6, 11)
- Pre-processing immagine (CLAHE, denoising, Otsu thresholding)
- Estrazione numeri con contesto (testo contenente numeri)
- Visualizzazione con rettangoli blu evidenti
- Click su lista per evidenziare numero sul documento
- Click su immagine per selezionare numero
- Evidenziazione multiple occorrenze con animazione lampeggiante
- Controlli zoom (25%-300%)
- Auto-scroll e ricentramento su elemento selezionato
- Raggruppamento e ordinamento numeri nella lista
- Visualizzazione conteggio occorrenze

### Tecnologie
- Backend: Python 3.13.5, Flask 3.0.0
- OCR: Tesseract 5.3.3 con lingua italiana e inglese
- PDF: Poppler 24.08.0
- Image processing: OpenCV, PIL/Pillow
- Frontend: HTML, CSS, JavaScript vanilla
- DPI: 300 per conversione PDF
- Confidenza minima OCR: 40%

### File principali
- `app.py`: Backend Flask con logica OCR
- `templates/index.html`: Interfaccia utente
- `static/style.css`: Stili e animazioni
- `static/script.js`: Logica frontend interattiva
- `requirements.txt`: Dipendenze Python
