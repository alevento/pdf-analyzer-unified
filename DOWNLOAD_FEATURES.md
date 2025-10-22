# Funzionalità Download - PDF Analyzer Unified

Questa applicazione supporta il **download universale dei risultati** in 3 formati per **tutti i tipi di estrazione**.

## Formati di Download Supportati

| Formato | Icona | Estensione | Descrizione |
|---------|-------|------------|-------------|
| **TXT** | 📄 | `.txt` | File di testo semplice |
| **CSV** | 📊 | `.csv` | Formato CSV per Excel/Calc |
| **JSON** | 💾 | `.json` | Formato JSON strutturato |

## Tipi di Estrazione con Download

### ✅ 1. Estrazione Numeri Avanzata (0° + 90°)
- **Modalità**: OCR avanzato con doppia rotazione
- **Dati scaricabili**:
  - Numeri estratti
  - Posizioni (x, y)
  - Confidenza OCR
  - Sorgente (0°, 90°, date, riferimenti, unità)
- **Formati**: TXT, CSV, JSON

### ✅ 2. PDFPlumber
- **Modalità**: Estrazione testo nativo PDF
- **Dati scaricabili**:
  - Testo estratto
  - Posizioni precise (x0, y0, x1, y1)
  - Dimensioni (width, height)
  - Pagina e rotazione
- **Formati**: TXT, CSV, JSON

### ✅ 3. OCR Standard
- **Modalità**: Tesseract OCR con PSM configurabile
- **Dati scaricabili**:
  - Testo completo estratto
  - Parole individuali con confidenza
  - PSM mode utilizzato
  - Confidenza media
- **Formati**: TXT, CSV, JSON

### ✅ 4. AI Analysis
- **Modalità**: Analisi intelligente multi-provider (Claude, GPT-4, Gemini, Llama)
- **Dati scaricabili**:
  - Numeri chiave identificati
  - Misure principali
  - Dimensioni rilevate
  - Note e osservazioni
  - Provider AI utilizzato
- **Formati**: TXT, CSV, JSON

### ✅ 5. AI Vision
- **Modalità**: Analisi visiva AI del documento
- **Dati scaricabili**:
  - Descrizione visuale completa
  - Provider AI utilizzato
  - Timestamp analisi
- **Formati**: TXT, CSV, JSON

### ✅ 6. AI Q&A
- **Modalità**: Domande e risposte specifiche
- **Dati scaricabili**:
  - Domanda posta
  - Risposta AI
  - Provider utilizzato
- **Formati**: TXT, CSV, JSON

### ✅ 7. AI Summary
- **Modalità**: Riepilogo intelligente del documento
- **Dati scaricabili**:
  - Informazioni chiave
  - Date importanti
  - Tipo documento
  - Osservazioni
  - Provider AI utilizzato
- **Formati**: TXT, CSV, JSON

## Come Usare il Download

1. **Esegui un'estrazione** (qualsiasi tipo tra quelli elencati sopra)
2. **Attendi il completamento** dell'elaborazione
3. **I pulsanti download appaiono automaticamente** nel pannello destro
4. **Clicca sul formato desiderato**: 📄 TXT, 📊 CSV, o 💾 JSON
5. **Il file viene scaricato** automaticamente nel browser

## Struttura Dati nei File Scaricati

### Esempio CSV
```csv
id,text,type,confidence,source,page
0,250,number,95.5,0deg,1
1,300x400,dimension,92.3,90deg,1
2,2024-10-22,date,98.1,date,1
```

### Esempio JSON
```json
[
  {
    "id": 0,
    "text": "250",
    "type": "number",
    "confidence": 95.5,
    "source": "0deg",
    "page": 1
  },
  {
    "id": 1,
    "text": "300x400",
    "type": "dimension",
    "confidence": 92.3,
    "source": "90deg",
    "page": 1
  }
]
```

### Esempio TXT
```
ID: 0
Testo: 250
Tipo: number
Confidenza: 95.5%
Fonte: 0deg
Pagina: 1

---

ID: 1
Testo: 300x400
Tipo: dimension
Confidenza: 92.3%
Fonte: 90deg
Pagina: 1
```

## Funzionalità Speciali

### Download PDFPlumber
Include informazioni dettagliate sulla posizione:
- `position.x0`, `position.y0`: Coordinate angolo in alto a sinistra
- `position.x1`, `position.y1`: Coordinate angolo in basso a destra
- `dimensions.width`, `dimensions.height`: Dimensioni del testo

### Download OCR Standard
Include due livelli di dati:
1. **Testo completo**: Risultato OCR intero
2. **Parole individuali**: Ogni parola con confidenza specifica

### Download AI Analysis/Summary
Include metadati provider:
- Nome provider AI utilizzato (Claude Opus 4, GPT-4 Turbo, etc.)
- Categorie di informazioni estratte
- Structured data per facile parsing

## Note Tecniche

- **Formato predefinito consigliato**: CSV per analisi in Excel
- **Formato per backup completo**: JSON per preservare struttura dati
- **Formato per lettura umana**: TXT per visualizzazione rapida
- **Encoding**: UTF-8 per tutti i formati
- **Separatore CSV**: virgola (`,`)
- **Nomi file automatici**: Includono tipo estrazione e timestamp

## Implementazione

I pulsanti download sono gestiti dinamicamente:
- ✅ **Mostrati automaticamente** quando ci sono risultati
- ❌ **Nascosti** quando non ci sono dati
- 🔄 **Aggiornati** ad ogni nuova estrazione

File coinvolti:
- `static/unified.js`: Logica download e conversione dati
- `unified_app.py`: Endpoint backend `/download_results/<format>`
- `templates/unified.html`: UI pulsanti download
