# Changelog - Analizzatore OCR per Disegni Tecnici


## v0.42 (2025-10-22)
### Feature
Unificata gestione prompt: interfaccia unica per prompt dimensioni e template con selettore radio

### Cosa è cambiato
- Creata interfaccia unificata "Gestione Prompt" che sostituisce le due sezioni separate
- Aggiunto selettore radio per switchare tra "Prompt Dimensioni" e "Prompt Template"
- Banner riepilogativo colorato che indica chiaramente quale tipo di prompt è selezionato
- Controlli unificati: libreria, carica, scarica, elimina, upload file, textarea, salva
- Retrocompatibilità mantenuta con il selettore dimensioni nella sezione Template

### UI unificata
Prompt Dimensioni:
- Banner arancione con icona 📐
- Textarea visibile per editing diretto
- Pulsante "Estrai" per esecuzione

Prompt Template:
- Banner verde con icona 📋
- Info caricamento al posto della textarea (template non editabile visualmente)
- Nessun pulsante estrazione (i template si usano con "Genera")

### Vantaggi
- Interfaccia più pulita e organizzata
- Ridotto spazio UI sulla destra
- Chiara indicazione visiva del contesto corrente
- Unica libreria di controlli per entrambe le tipologie

### File modificati
- `templates/unified.html`: Sostituita sezione dimensioni con unified prompt manager
- `static/unified.js`: Aggiunte funzioni unified prompt manager (switchPromptType, loadUnifiedPrompt, saveUnifiedPrompt, deleteUnifiedPrompt, downloadUnifiedPrompt)
- `static/unified.js`: Inizializzazione automatica al caricamento pagina

### Funzioni JavaScript aggiunte
- `switchPromptType(type)`: Switch tra dimensioni e template
- `loadDimensionPromptsListForUnified()`: Carica lista prompt dimensioni
- `loadTemplatePromptsListForUnified()`: Carica lista template
- `loadUnifiedPrompt()`: Carica prompt selezionato
- `saveUnifiedPrompt()`: Salva prompt corrente
- `deleteUnifiedPrompt()`: Elimina prompt selezionato
- `downloadUnifiedPrompt()`: Scarica prompt come file .txt
- `executeUnifiedPrompt()`: Esegue estrazione dimensioni
- `updateUnifiedPromptButtons()`: Aggiorna stato pulsanti
- `setupUnifiedPromptFileUpload()`: Gestisce upload file
- `loadDimensionPromptsForTemplateSelector()`: Popola selettore nella sezione template


## v0.41 (2025-10-22)
### Fix
Fix errore encoding Windows: rimossi caratteri Unicode (✓ ✗) dai log che causavano crash su terminale Windows

### Problema risolto
Errore: "'charmap' codec can't encode character '\u2713' in position 2: character maps to <undefined>"
Causa: Terminale Windows (CMD) usa codepage 'charmap' (CP1252) che non supporta simboli Unicode

### Soluzione
Sostituiti caratteri Unicode con alternative ASCII-safe:
- ✓ → [OK]
- ✗ → [FAILED]

### Log aggiornati
Prima:
```
  ✓ Success with temperature +0.3
  ✗ All retry attempts failed
```

Ora:
```
  [OK] Success with temperature +0.3
  [FAILED] All retry attempts failed
```

### File modificati
- unified_app.py: Sostituiti caratteri Unicode nei print statements

---


## v0.40 (2025-10-22)
### Miglioramento
Retry progressivi multipli per errori safety: ora prova temperature 0.1, 0.2, 0.3, 0.4, 0.5 fino al successo

### Problema risolto (v0.39)
Sistema retry con solo +0.1 non sufficiente per alcuni contenuti che triggerano safety filters

### Nuova soluzione (v0.40)
Retry progressivi con incrementi graduali fino a trovare temperatura che funziona:

**Sequenza tentativi per Gemini:**
1. Temperatura 0.0 (normale) → errore safety
2. Temperatura 0.1 (+0.1) → se errore, continua
3. Temperatura 0.2 (+0.2) → se errore, continua
4. Temperatura 0.3 (+0.3) → se errore, continua
5. Temperatura 0.4 (+0.4) → se errore, continua
6. Temperatura 0.5 (+0.5) → ultimo tentativo

**Log dettagliato nel terminale:**
```
Safety error detected with Gemini 2.5 Pro, retrying with progressively increased temperature...
  Attempt with temperature +0.1...
  Attempt with temperature +0.2...
  Attempt with temperature +0.3...
  ✓ Success with temperature +0.3
```

### Vantaggi
- Massimizza probabilità di successo (5 tentativi invece di 1)
- Usa temperatura minima necessaria
- Log trasparente per debugging
- Valori configurati rimangono invariati

### Temperature massime per provider
- **Gemini**: fino a 0.5 (base 0.0 + incrementi)
- **Claude**: 1.0 (già al massimo API)
- **GPT-4.1**: fino a 1.2 (base 0.7 + incrementi, max API 2.0)
- **Qwen**: fino a 1.0 (base 0.6 + incrementi, capped)

### Implementazione
- unified_app.py: Modificato generate_excel_from_template_with_opus() con loop incrementi
- unified_app.py: Aggiunto parametro temp_increment a retry_with_increased_temperature()
- Loop progressivo: for increment in [0.1, 0.2, 0.3, 0.4, 0.5]
- Break al primo successo

### File modificati
- unified_app.py: Sistema retry progressivo con log dettagliato

---


## v0.39 (2025-10-22)
### Nuova funzionalità
Sistema retry automatico con temperatura aumentata per errori safety nella generazione template

### Funzionamento
Se durante la generazione template si verifica un errore safety (temperatura troppo bassa):
1. Sistema rileva automaticamente l'errore (parole chiave: safety, finish_reason, blocked, recitation)
2. Riprova immediatamente con temperatura aumentata di 0.1
3. Non modifica i valori salvati permanentemente
4. Log nel terminale: "Safety error detected, retrying with increased temperature (+0.1)..."

### Temperature retry per provider
- **Gemini**: 0.0 → 0.1 (retry temporaneo)
- **Claude Opus/Sonnet**: 1.0 → 1.1 (capped a 1.0 dall'API)
- **GPT-4.1**: 0.7 → 0.8 (retry temporaneo)
- **Qwen (Novita)**: 0.6 → 0.7 (retry temporaneo)

### Vantaggi
- Nessun intervento manuale richiesto
- Valori configurati rimangono invariati
- Successo automatico in caso di safety block
- Esperienza utente fluida (retry trasparente)

### Implementazione
- unified_app.py: Nuova funzione retry_with_increased_temperature()
- unified_app.py: Modificata generate_excel_from_template_with_opus() con try-catch e retry
- Gestisce tutti i provider con temperature specifiche

### File modificati
- unified_app.py: Aggiunte logica retry e funzione helper

---


## v0.38 (2025-10-22)
### Fix
Fix generazione template: dimensioni multi-valore ora preservate integralmente (es: "1540x1270x835" invece di solo "1540")

### Problema risolto
Prima: Dimensioni come "1540x1270x835" venivano troncate a "1540" nel template Excel
Ora: Valore completo preservato esattamente come estratto dall'AI

### Soluzione implementata
Prompt migliorato con istruzioni esplicite a tre livelli:

1. **Dimension notice**: "CRITICO: Copia le dimensioni ESATTAMENTE come fornite"
2. **Esempio specifico**: "Se hai '1540x1270x835', mantieni IL VALORE COMPLETO"
3. **Regole importanti**: "usa il valore COMPLETO senza modifiche (es: '1540x1270x835' nella cella, NON solo '1540')"

### Dettagli tecnici
- unified_app.py: Aggiornato prompt generate_excel_from_template_with_opus()
- Istruzioni in MAIUSCOLO per enfatizzare criticità
- Esempio concreto "1540x1270x835" ripetuto in più punti del prompt
- Applicato a tutti i provider AI (Gemini, Claude, GPT-4.1)

### File modificati
- unified_app.py: Prompt dimension_notice e regole importanti

---


## v0.37 (2025-10-22)
### Ottimizzazione
Sistema cache per dimensioni estratte: riutilizzo automatico in generazione template senza consumare token API

### Funzionalità
Se l'estrazione dimensioni è già stata eseguita manualmente (tab "Estrazione Dimensioni"):
- La generazione template riutilizza automaticamente quei dati
- Nessuna chiamata API aggiuntiva
- Nessun consumo di token
- Messaggio chiaro: "Riutilizzo dimensioni - Uso dimensioni già estratte (nessun token consumato)"

### Flusso ottimizzato
1. Utente estrae dimensioni manualmente → dati salvati in `currentExtractedDimensions`
2. Utente genera template con stesso file → sistema rileva cache e riusa dati
3. Risparmio: 1 chiamata API vision + token risparmiati

### Dettagli tecnici
- unified.js: generateFromTemplate() controlla `currentExtractedDimensions` prima di chiamare API
- Se presente: riutilizzo immediato con provider name originale
- Se assente: estrazione normale con API

### File modificati
- static/unified.js: Aggiunto controllo cache in generateFromTemplate()

---


## v0.36 (2025-10-22)
### Modifiche
Parametri Gemini impostati su valori estremamente deterministici per output ripetibili e consistenti

### Dettagli tecnici
- Temperature: 0.7 → 0.0 (massimo determinismo)
- Top-p: 0.95 → 0.1 (campionamento molto restrittivo)
- Top-k: 40 → 1 (solo token più probabile)
- Max output tokens: 8192 (invariato)

### Comportamento
Con temperature=0.0 e top_k=1, Gemini selezionerà sempre il token più probabile, producendo output identici per lo stesso input. Ideale per estrazioni dimensioni ripetibili e analisi tecniche deterministiche.

### File modificati
- ai_providers.py: Aggiornati tutti e tre i metodi GeminiProvider (analyze_text, analyze_vision, chat)

---


## v0.35 (2025-10-22)
### Aggiornamento
Aggiornato OpenAI da GPT-4o a GPT-4.1 (modello più recente con vision potenziata per disegni tecnici)

### Dettagli tecnici
- Modello API: gpt-4o → gpt-4.1-2025-04-14
- Nome provider UI: GPT-4o → GPT-4.1
- Rilasciato: 14 aprile 2025
- Migliori capacità vision per matematica, grafici, diagrammi (benchmark MMMU, MathVista, CharXiv)
- Supporto fino a 1M token di contesto
- Miglior instruction following per prompt personalizzati

### File modificati
- ai_providers.py: Aggiornato OpenAIProvider con nuovo modello e descrizione

---


## v0.34 (2025-10-22)
### Fix
Fix provider dinamico estrazione dimensioni: ora mostra il provider AI effettivamente usato (non più hardcoded Opus)

### Dettagli tecnici
- Frontend: extractDimensionsForTemplate ora ritorna {text, provider} invece di solo text
- Backend: generate_excel_from_template_with_opus estrae provider name e lo include nel prompt e nelle note
- Template Excel generato ora mostra correttamente "Dimensioni estratte con [Provider Selezionato]"

---


## v0.33 (2025-10-22)
### Modifiche
Ripristinati parametri precedenti Gemini: temp=0.7, top_p=0.95, top_k=40 (mantenuta gestione errori finish_reason)

---


## v0.32 (2025-10-22)
### Modifiche
Fix Gemini safety blocks: aumentata temperatura da 0.2 a 0.4 e aggiunta gestione errori finish_reason con messaggi chiari

---


## v0.31 (2025-10-22)
### Modifiche
Abilitata modalità Thinking per Qwen 3 VL 235B: enable_thinking=True con parametri ottimizzati (temp=0.6, top_p=0.95) per ragionamento avanzato

---


## v0.30 (2025-10-22)
### Modifiche
Migliorata gestione timeout Novita AI: timeout aumentato a 5 minuti e messaggi di errore più chiari con suggerimenti

---


## v0.29 (2025-10-22)
### Modifiche
Estrazione dimensioni ora usa Vision API per tutti i provider (Claude incluso) per maggiore accuratezza nel rilevamento

---


## v0.28 (2025-10-22)
### Modifiche
Messaggi e commenti ora usano provider AI selezionato invece di riferimenti hardcoded a Claude Opus

---


## v0.27 (2025-10-22)
### Modifiche
Aggiunto Claude Sonnet 4.5 come provider separato - Best for coding and complex agents

---


## v0.26 (2025-10-22)
### Modifiche
Aggiornato a Claude Opus 4.1 (claude-opus-4-1-20250805) per analisi e estrazione dimensioni

---


## v0.25 (2025-10-22)
### Modifiche
Fix: Ripristinato modello Claude Opus 4 (4.1 non esiste) - Mantenuta ottimizzazione Text API

---


## v0.24 (2025-10-22)
### Modifiche
Aggiornato Claude Opus 4 a 4.1 + estrazione dimensioni usa Text API invece di Vision per ottimizzazione costi

---


## v0.23 (2025-10-22)
### Modifiche
Estrazione dimensioni ora mostra provider AI selezionato invece di Claude Opus hardcoded

---


## v0.22 (2025-10-22)
### Modifiche
Fix NameError ai_provider_manager + UI miglioramenti AI Analysis

---


## v0.21 (2025-10-22)
### Modifiche
Estrazione dimensioni e template usano provider AI selezionato dinamicamente

---


## v0.20 (2025-10-22)
### Modifiche
Fix GPT-4 Vision deprecato - Aggiornamento a GPT-4o multimodale

---


## v0.19 (2025-10-22)
### Modifiche
Integrazione Qwen 3 VL 235B via Novita AI - Modello multimodale text/image/video

---


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
