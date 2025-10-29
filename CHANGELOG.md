# Changelog - Analizzatore OCR per Disegni Tecnici


## v0.56 (2025-10-29)
### Auto-Analisi Layout per PDF Multi-Pagina
Implementata analisi layout automatica al caricamento di PDF con più pagine quando esiste un prompt layout predefinito.

### Funzionalità
Quando viene caricato un PDF con più di 1 pagina e esiste un prompt di layout contrassegnato come predefinito (⭐):
1. **Rilevamento Automatico**: Il sistema rileva automaticamente che è un PDF multi-pagina
2. **Verifica Prompt Predefinito**: Controlla se esiste un prompt layout predefinito
3. **Analisi Automatica**: Esegue l'analisi layout su tutte le pagine usando il prompt predefinito
4. **Risultati Immediati**: I risultati vengono mostrati immediatamente dopo il caricamento

### Esperienza Utente
**Prima (v0.55):**
```
1. Carica PDF multi-pagina
2. Vai nella sezione Layout
3. Seleziona manualmente il prompt
4. Clicca "Analizza PDF"
5. Attendi i risultati
```

**Dopo (v0.56):**
```
1. Carica PDF multi-pagina
2. ✅ Analisi layout automatica già completata!
```

### Dettagli Tecnici

**Backend (unified_app.py):**
- Modificata funzione `upload_file()` (righe 1591-1652)
- Controlla `page_count > 1` dopo caricamento PDF
- Cerca prompt layout con `is_default: True`
- Esegue analisi su tutte le pagine con AI provider corrente
- Gestisce errori per pagina senza bloccare l'upload
- Restituisce risultati in JSON: `auto_layout_executed`, `layout_analysis`

**Frontend (unified.js):**
- Modificata funzione `uploadFile()` (righe 235-276)
- Controlla flag `data.auto_layout_executed`
- Mostra risultati in box colorato con icona 🗂️
- Lista pagine con analisi o errori per pagina
- Aggiorna status con conteggio pagine analizzate

### Struttura Risultati
```json
{
  "auto_layout_executed": true,
  "layout_analysis": {
    "prompt_name": "Nome del prompt usato",
    "prompt_id": "uuid",
    "provider": "Claude Opus 4",
    "results": [
      {
        "page": 1,
        "analysis": "Questa pagina contiene un disegno tecnico..."
      },
      {
        "page": 2,
        "error": "Timeout durante l'analisi"
      }
    ]
  }
}
```

### UI Miglioramenti
- Box blu distintivo per risultati auto-analisi
- Intestazione con emoji 🗂️
- Info prompt e provider utilizzati
- Scroll automatico per documenti lunghi
- Errori per pagina mostrati chiaramente in rosso

### File Modificati
- `unified_app.py`: Funzione `upload_file()` con logica auto-analisi (righe 1591-1668)
- `static/unified.js`: Funzione `uploadFile()` con visualizzazione risultati (righe 235-276)

### Vantaggi
- ⚡ **Risparmio Tempo**: Analisi automatica, nessun click manuale necessario
- 🎯 **Zero Configurazione**: Funziona immediatamente se hai un prompt predefinito
- 🔄 **Processo Unificato**: Upload + analisi in un solo passaggio
- 💡 **Feedback Immediato**: Vedi subito quali pagine hanno disegni
- 🛡️ **Resiliente**: Errori su singole pagine non bloccano l'intero processo

### Note
- Funziona solo con PDF multi-pagina (>1 pagina)
- Richiede un prompt layout contrassegnato come predefinito (⭐)
- Usa il provider AI attualmente selezionato
- Tempo di caricamento aumentato proporzionalmente al numero di pagine


## v0.55 (2025-10-29)
### Fix: Template non compaiono nella lista
Corretto bug che impediva la visualizzazione dei template salvati nel gestore prompt unificato.

### Problema
Dopo aver salvato un template per la generazione di file Excel, questo non compariva nella lista dei prompt salvati e non era possibile selezionarlo dal dropdown.

### Causa
L'endpoint `/get_templates` restituiva solo:
```python
return jsonify({'templates': [...]})
```

Ma il frontend controllava:
```javascript
if (data.success && data.templates) {  // ❌ data.success è undefined
```

Tutti gli altri endpoint (dimension, layout) restituiscono `{'success': True, ...}`, ma questo era inconsistente.

### Soluzione
Aggiunto campo `success: True` alla risposta dell'endpoint `/get_templates`:
```python
return jsonify({'success': True, 'templates': [...]})
```

### File Modificati
- `unified_app.py`: Endpoint `/get_templates` (righe 2601, 2606)

### Impatto
✅ I template salvati ora compaiono correttamente nella lista
✅ È possibile selezionare e caricare i template
✅ Comportamento coerente con dimension e layout prompts


## v0.54 (2025-10-29)
### Gestione Prompt Predefiniti
Aggiunta possibilità di definire un prompt predefinito per ogni tipologia (dimensioni, layout, template) che viene precaricato automaticamente all'apertura della sezione.

### Funzionalità Implementate
1. **Indicatore Visivo Prompt Predefinito**: Stella ⭐ mostrata accanto al nome del prompt predefinito nei dropdown
2. **Pulsante Imposta Predefinito**: Nuovo pulsante ⭐ arancione nella sezione di gestione prompt per impostare rapidamente un prompt come predefinito
3. **Precaricamento Automatico**: Quando si cambia tipo di prompt (Dimensioni/Layout/Template), il prompt predefinito viene caricato automaticamente
4. **Gestione Multi-Tipo**: Sistema unificato che funziona per tutti e tre i tipi di prompt (dimension, layout, template)

### Endpoint Backend Aggiunti
- `POST /set_default_prompt/<prompt_type>/<prompt_id>`: Imposta un prompt come predefinito per il suo tipo
- `POST /remove_default_prompt/<prompt_type>`: Rimuove lo stato predefinito da tutti i prompt di un tipo
- `GET /get_default_prompt/<prompt_type>`: Ottiene il prompt predefinito per un tipo specifico
- Funzione helper `get_prompts_file_path(prompt_type)`: Gestisce i percorsi dei file per tutti i tipi di prompt

### Modifiche Frontend
**unified.js:**
- `loadDimensionPromptsListForUnified()`: Aggiunta stella ⭐ per prompt predefiniti
- `loadTemplatePromptsListForUnified()`: Aggiunta stella ⭐ per template predefiniti e nella lista visibile
- `loadLayoutPromptsListForUnified()`: Aggiunta stella ⭐ per prompt predefiniti
- `loadDefaultPromptForType(promptType)`: Nuova funzione per caricare automaticamente il prompt predefinito
- `switchPromptType(type)`: Modificata per chiamare precaricamento dopo il caricamento della lista
- `setUnifiedPromptAsDefault()`: Nuova funzione per impostare un prompt come predefinito tramite UI

**unified.html:**
- Aggiunto pulsante ⭐ arancione nella sezione "Prompt Salvati" con tooltip "Imposta come predefinito"

### Struttura Dati
I prompt salvati ora includono il campo `is_default`:
```json
{
  "prompts": [
    {
      "id": "uuid",
      "name": "Nome Prompt",
      "content": "contenuto...",
      "created_at": "timestamp",
      "is_default": true
    }
  ]
}
```

### Workflow Utente
1. **Impostare Predefinito**:
   - Selezionare un prompt dalla lista
   - Cliccare pulsante ⭐ arancione
   - Il prompt viene contrassegnato con stella ⭐ nella lista

2. **Uso Automatico**:
   - Cambiare tipo di prompt (es. da Dimensioni a Layout)
   - Il prompt predefinito per quel tipo viene caricato automaticamente
   - Non serve più selezionarlo manualmente ogni volta

### File Modificati
- `unified_app.py`: Aggiunti endpoint per gestione prompt predefiniti (righe 3003-3132)
- `static/unified.js`: Modificate funzioni di caricamento liste e aggiunta gestione predefiniti
- `templates/unified.html`: Aggiunto pulsante ⭐ per impostazione predefinito (riga 892)

### Benefici
- ✅ Flusso di lavoro più rapido: prompt preferiti sempre pronti
- ✅ Riduzione errori: prompt corretto caricato automaticamente
- ✅ Consistenza: stessa esperienza su tutti i tipi di prompt
- ✅ Visibilità: stella mostra chiaramente quale è il prompt predefinito


## v0.53 (2025-10-29)
### Miglioramenti UI e configurazione
Aumentata dimensione font e impostato Gemini come provider predefinito

### Modifiche
1. **Aumento dimensione font**: Tutti i font-size aumentati di 2 punti per migliorare la leggibilità
   - 10px → 12px
   - 11px → 13px
   - 12px → 14px
   - 13px → 15px
   - 14px → 16px
   - 16px → 18px
   - 18px → 20px
   - 24px → 26px

2. **Gemini come provider predefinito**: Spostato Gemini 2.5 Pro come primo provider AI nell'ordine di inizializzazione, rendendolo il provider predefinito se disponibile

### File modificati
- `templates/unified.html`: Aumentati tutti i font-size di 2 punti
- `ai_providers.py`: Spostato Gemini all'inizio dell'inizializzazione provider (riga 574)


## v0.52 (2025-10-29)
### Fix
Corretto errore "Nessun PDF caricato" nell'analisi layout

### Problema
Quando si utilizzava la funzione "🗂️ Analizza PDF" dal tipo di prompt Layout, anche dopo aver caricato un PDF, si verificava l'errore:
```
Errore: Nessun PDF caricato
```

### Causa
La funzione `analyze_layout()` cercava il nome del PDF nella sessione Flask:
```python
if 'current_pdf' not in session:  # ❌ session['current_pdf'] non esiste
    return jsonify({'error': 'Nessun PDF caricato'}), 400
```

Ma la funzione `upload_file()` salva sempre il PDF con il nome fisso `'current.pdf'` senza memorizzarlo nella sessione. Tutte le altre funzioni dell'app (come `get_page()`) usano direttamente il percorso fisso.

### Soluzione
Modificata la funzione `analyze_layout()` per usare il percorso fisso come tutte le altre funzioni:
```python
# Prima (BROKEN):
if 'current_pdf' not in session:
    return jsonify({'error': 'Nessun PDF caricato'}), 400
pdf_filename = session['current_pdf']
pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], pdf_filename)

# Ora (FIXED):
pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], 'current.pdf')
if not os.path.exists(pdf_path):
    return jsonify({'error': 'Nessun PDF caricato'}), 400
```

### File modificati
- `unified_app.py`: Modificata funzione `analyze_layout()` per usare percorso fisso (righe 3025-3029)


## v0.51 (2025-10-29)
### Fix
Corretto errore "name 'session' is not defined" nell'analisi layout

### Problema
Quando si utilizzava la funzione "🗂️ Analizza PDF" dal tipo di prompt Layout, si verificava un errore:
```
Errore durante l'analisi layout: name 'session' is not defined
```

### Causa
La variabile `session` non era importata da Flask in `unified_app.py`, ma veniva utilizzata nella funzione `analyze_layout()` per accedere al PDF corrente:
```python
if 'current_pdf' not in session:  # ❌ Error: session non definito
```

### Soluzione
Aggiunto `session` all'import di Flask alla riga 12:
```python
# Prima (BROKEN):
from flask import Flask, render_template, request, jsonify, send_file

# Ora (FIXED):
from flask import Flask, render_template, request, jsonify, send_file, session
```

### File modificati
- `unified_app.py`: Aggiunto `session` all'import di Flask (riga 12)


## v0.50 (2025-10-28)
### Fix
Corretto errore "Cannot set properties of null" in dimension_prompts.js

### Problema
Quando si usava il pulsante "📐 Estrai" dall'unified prompt manager, si verificava un errore:
```
TypeError: Cannot set properties of null (setting 'disabled')
at extractDimensions (dimension_prompts.js:62)
```

### Causa
La funzione `extractDimensions()` in `dimension_prompts.js` cercava di accedere a elementi DOM che non esistono più:
- `extractDimensionsBtn` → Non esiste nell'unified prompt manager
- `dimensionStatus` → Non esiste nell'unified prompt manager

### Soluzione
Aggiunta logica di fallback per trovare elementi sia legacy che unified:
```javascript
// Prima (BROKEN):
const extractBtn = document.getElementById('extractDimensionsBtn');
extractBtn.disabled = true;  // ❌ Error: extractBtn is null

// Ora (FIXED):
const extractBtn = document.getElementById('extractDimensionsBtn') ||
                   document.getElementById('executePromptBtn');
if (extractBtn) {
    extractBtn.disabled = true;  // ✅ Safe
}
```

Applicato null check a tutti gli elementi DOM:
- `extractBtn` / `executePromptBtn`
- `dimensionStatus` / `unifiedPromptStatus`
- `downloadButtons`
- `textList`
- `status`

### Compatibilità
Ora la funzione funziona sia con:
- ✅ Unified Prompt Manager (nuovo)
- ✅ Legacy dimension prompts UI (vecchio, se presente)

### File modificati
- `static/dimension_prompts.js`: Aggiunti null checks e fallback elementi (linee 56-144)


## v0.49 (2025-10-28)
### Nuova Funzionalità - Prompt Layout
Aggiunta terza tipologia di prompt per analizzare la struttura del documento PDF

### Funzionalità
**Gestione Prompt Layout**: Nuovo tipo di prompt che permette di:
1. Identificare quali pagine del PDF contengono disegni tecnici
2. Riconoscere se i disegni hanno layout a sezione singola o multipla
3. Analizzare automaticamente tutte le pagine del documento
4. Generare report completo con analisi pagina per pagina

### UI Aggiornata
**Interfaccia Unificata a 3 Tipi**:
- 📐 **Dimensioni**: Estrazione dimensioni da singola pagina
- 📋 **Template**: Generazione Excel/CSV
- 🗂️ **Layout**: Analisi struttura documento (NUOVO)

**Colori distintivi**:
- Dimensioni: Giallo/Arancio (#fff3cd / #ff9800)
- Template: Verde (#d4edda / #3498db)
- Layout: Blu (#e3f2fd / #2196f3)

**Pulsante esecuzione Layout**: "🗂️ Analizza PDF"

### Backend
**Nuovi Endpoint**:
```python
GET  /get_layout_prompts           # Lista prompt layout salvati
GET  /get_layout_prompt/<id>       # Dettagli prompt specifico
POST /save_layout_prompt           # Salva nuovo prompt layout
DEL  /delete_layout_prompt/<id>    # Elimina prompt layout
POST /analyze_layout               # Analizza intero documento
```

**Analisi Multi-Pagina**:
- Itera su tutte le pagine del PDF
- Converte ogni pagina in immagine ad alta risoluzione
- Analizza con AI vision (supporta tutti i provider configurati)
- Gestisce errori per singola pagina senza bloccare l'intero processo
- Report formattato con separatori visivi

**Struttura Dati**:
```
layout_prompts/
└── layout_prompts.json
    {
      "prompts": [
        {
          "id": "uuid",
          "name": "Analisi Layout Standard",
          "content": "prompt text...",
          "created_at": "2025-10-28T..."
        }
      ]
    }
```

### Frontend
**Nuove Funzioni JavaScript**:
```javascript
loadLayoutPromptsListForUnified()      // Carica lista prompt
analyzeDocumentLayout()                 // Esegue analisi completa
downloadLayoutAnalysis()                // Scarica risultati TXT
```

**Supporto Completo**:
- Salvataggio/Caricamento prompt layout
- Auto-popolamento nome da file .txt
- Gestione duplicati intelligente
- Download risultati analisi con timestamp
- Indicatore progresso durante analisi multi-pagina

### Esempio Prompt Layout
```
Analizza questa pagina e indica:
1. Contiene un disegno tecnico? (SI/NO)
2. Se SI, tipo di layout:
   - SEZIONE SINGOLA: un solo disegno principale
   - SEZIONI MULTIPLE: più disegni o viste multiple

Rispondi in formato:
Pagina [N]: [SI/NO] - [TIPO LAYOUT se SI]
```

### Caso d'Uso
**Scenario**: PDF di 50 pagine con mix di disegni e documentazione

**Prima**: Analisi manuale pagina per pagina

**Ora**:
1. Carica PDF
2. Seleziona "🗂️ Layout"
3. Scegli o crea prompt layout
4. Clicca "🗂️ Analizza PDF"
5. Attendi analisi completa
6. Scarica report TXT con analisi di tutte le 50 pagine

**Risultato**: Report automatico che identifica esattamente quali pagine contengono disegni e la loro struttura

### Performance
- ⚠️ **Attenzione**: L'analisi di documenti con molte pagine può richiedere diversi minuti
- Ogni pagina richiede una chiamata API al provider AI
- Messaggio informativo mostrato durante l'elaborazione
- Gestione timeout e errori per provider specifici

### File Modificati
**Frontend**:
- `templates/unified.html`: Aggiunto terzo radio button (linee 865-868)
- `static/unified.js`:
  - `switchPromptType()` esteso per layout (linee 2287-2300)
  - Nuove funzioni load/save/delete/execute per layout (linee 2405-3029)
  - `analyzeDocumentLayout()` per analisi multi-pagina (linee 2911-2980)
  - `downloadLayoutAnalysis()` per download risultati (linee 2985-3029)

**Backend**:
- `unified_app.py`:
  - Configurazione `LAYOUT_PROMPTS_FOLDER` (linee 45, 52)
  - Endpoint CRUD per layout prompts (linee 2872-3000)
  - `/analyze_layout` per analisi documento completo (linee 3003-3098)

### Compatibilità
- ✅ Tutti i provider AI con supporto vision (Claude, GPT-4, Gemini)
- ✅ PDF con qualsiasi numero di pagine
- ✅ Backward compatible con prompt dimensioni e template esistenti


## v0.48 (2025-10-28)
### Fix Critico
Risolto bug che impediva il caricamento dei prompt salvati

### Problema
Il dropdown dei prompt mostrava sempre solo "-- Seleziona --" anche quando c'erano prompt salvati. Quando si tentava di salvare un prompt duplicato:
1. ✅ Il backend rilevava correttamente il duplicato
2. ✅ Il frontend ricaricava la lista
3. ❌ Ma i prompt non apparivano mai nel dropdown
4. ❌ Console: "Options: 1" (solo l'opzione default)

### Causa
**Backend e Frontend non comunicavano correttamente**:
- Backend (`get_dimension_prompts`):
  ```python
  return jsonify({'prompts': [...]})  # Mancava 'success': True
  ```
- Frontend (`loadDimensionPromptsListForUnified`):
  ```javascript
  if (data.success && data.prompts) {  // data.success era undefined!
      // Questo codice non veniva MAI eseguito
  }
  ```

### Soluzione
Backend ora restituisce sempre `success: true`:
```python
return jsonify({'success': True, 'prompts': prompts_data.get('prompts', [])})
```

### Logging aggiunto per debugging
Nel frontend per diagnosticare problemi futuri:
```javascript
console.log('Loading dimension prompts list...');
console.log('Dimension prompts response:', data);
console.log(`Found ${data.prompts.length} dimension prompts`);
console.log(`Added prompt: ${prompt.name} (ID: ${prompt.id})`);
```

### Comportamento ora corretto
```
1. Utente importa prompt "ATV gemini 4"
2. Prompt già esiste → Backend restituisce errore 400
3. Frontend rileva "già esistente"
4. Ricarica lista → Backend restituisce {'success': true, 'prompts': [...]}
5. Dropdown popolato correttamente
6. Prompt selezionato automaticamente
```

### File modificati
- `unified_app.py`: Aggiunto `'success': True` in `get_dimension_prompts()` (linee 2738, 2743)
- `static/unified.js`: Aggiunto logging diagnostico in `loadDimensionPromptsListForUnified()` (linee 2316-2335)


## v0.47 (2025-10-28)
### Fix
Corretto errore "currentPdfFile is not defined" e problemi con aggiornamento stato pulsanti

### Problemi risolti
1. **Error console**: `ReferenceError: currentPdfFile is not defined at updateUnifiedPromptButtons`
   - La variabile `currentPdfFile` veniva usata ma mai dichiarata né popolata
   - Il pulsante "Estrai Dimensioni" non si abilitava correttamente dopo caricamento PDF

2. **Error console**: `Cannot set properties of null (setting 'innerHTML')` in dimension_prompts.js
   - Il file `dimension_prompts.js` tentava di accedere a elementi DOM rimossi nella v0.42 (unified prompt manager)
   - Causava errori in console anche se non bloccanti

3. **Mancato aggiornamento pulsanti**: I pulsanti Salva/Estrai non si aggiornavano durante la digitazione

### Soluzioni implementate
1. **Tracciamento stato PDF**:
   - Aggiunta dichiarazione globale: `let currentPdfFile = null;`
   - Popolamento variabile dopo upload PDF: `currentPdfFile = file;`
   - Chiamata `updateUnifiedPromptButtons()` dopo upload per aggiornare stato UI

2. **Event listeners reattivi**:
   - Aggiunti listener `input` su `unifiedPromptContent` per aggiornare pulsanti mentre si scrive
   - Aggiunti listener `input` su `unifiedPromptName` per validare in tempo reale
   - I pulsanti ora si abilitano/disabilitano dinamicamente in base al contenuto

3. **Compatibilità retroattiva dimension_prompts.js**:
   - Aggiunto null check in `loadDimensionPromptsList()`:
     ```javascript
     const select = document.getElementById('savedDimensionPromptsSelect');
     if (!select) return; // Element doesn't exist - using unified manager
     ```
   - Previene errori quando gli elementi legacy non esistono

### Comportamento ora corretto
```
1. Utente carica PDF → currentPdfFile salvato
2. Utente carica prompt .txt → nome auto-popolato
3. Mentre scrive nel prompt → pulsante Salva si abilita
4. Pulsante Estrai abilitato SOLO se: prompt non vuoto E PDF caricato
5. Nessun errore console da dimension_prompts.js
```

### File modificati
- `static/unified.js`:
  - Aggiunta variabile globale `currentPdfFile` (linea 10)
  - Popolamento in `uploadFile()` dopo successo (linea 141)
  - Chiamata `updateUnifiedPromptButtons()` dopo upload (linea 184)
  - Event listeners per input prompt e nome (linee 1317-1322)
- `static/dimension_prompts.js`:
  - Null check in `loadDimensionPromptsList()` (linee 128-131)


## v0.46 (2025-10-22)
### Fix
Corretto bug selezione automatica prompt salvati - mismatch nome campo ID

### Problema risolto
La selezione automatica dei prompt appena salvati NON funzionava perché:
- Backend restituiva `prompt_id` e `template_id`
- Frontend cercava `data.id`
- La selezione nel dropdown falliva silenziosamente

### Soluzione
- Corretto fetch dell'ID: `data.prompt_id || data.id` per dimensioni
- Corretto fetch dell'ID: `data.template_id || data.id` per template
- Aggiunto logging estensivo per diagnostica:
  - Log della risposta del backend
  - Log del messaggio di errore
  - Log della rilevazione duplicati
  - Log del processo di selezione nel dropdown
  - Warning se il prompt non viene trovato dopo il reload

### Debug logging aggiunto
```javascript
console.log('Save dimension prompt response:', data);
console.log('Error message:', errorMsg);
console.log('Duplicate detected, reloading list...');
console.log('Select element:', select, 'Options:', select?.options.length);
console.log(`Checking option ${i}: "${text}" vs "${name}"`);
console.log('Found and selected at index', i);
console.warn('Prompt not found in dropdown after reload');
```

### Testing
Ora è possibile vedere nella console del browser esattamente cosa succede quando:
1. Salvi un nuovo prompt
2. Tenti di salvare un duplicato
3. Il sistema seleziona automaticamente il prompt

### File modificati
- `static/unified.js`: Corretti nomi campi ID e aggiunto logging diagnostico


## v0.45 (2025-10-22)
### Fix
Gestione intelligente dei prompt duplicati: ricarica lista e selezione automatica

### Problema risolto
Quando l'utente importava un file con un nome già esistente:
- Il backend restituiva errore "già esistente"
- Il frontend mostrava solo l'errore
- La lista NON veniva ricaricata
- L'utente non vedeva il prompt esistente nel dropdown

### Soluzione implementata
Quando si tenta di salvare un prompt/template con nome già esistente:
1. Il sistema riconosce l'errore "già esistente"
2. Ricarica automaticamente la lista dei prompt
3. Cerca e seleziona automaticamente il prompt esistente per nome
4. Mostra messaggio informativo: "ℹ️ Prompt '[Nome]' già esistente - selezionato automaticamente"

### Comportamento prima
```
1. Carica file "Dimensioni.txt"
2. Nome auto-popolato: "Dimensioni"
3. Clicca Salva
4. Errore: "❌ Prompt 'Dimensioni' già esistente"
5. Lista NON aggiornata → prompt non visibile
```

### Comportamento ora
```
1. Carica file "Dimensioni.txt"
2. Nome auto-popolato: "Dimensioni"
3. Clicca Salva
4. Sistema: "ℹ️ Prompt 'Dimensioni' già esistente - selezionato automaticamente"
5. Lista ricaricata → prompt selezionato nel dropdown
6. Puoi subito usarlo o modificarlo
```

### Vantaggi
- Nessun prompt "perso" o invisibile
- UX più intuitiva e trasparente
- Feedback chiaro sull'esistenza del prompt
- Selezione automatica per uso immediato
- Funziona sia per prompt dimensioni che template

### File modificati
- `static/unified.js`: Aggiunta gestione intelligente errore "già esistente" in saveUnifiedPrompt()


## v0.44 (2025-10-22)
### Improvement
Auto-popolamento nome file e selezione automatica dopo salvataggio prompt

### Cosa è cambiato
- Quando si carica un file .txt per un prompt (dimensioni o template), il campo "Nome" viene auto-popolato con il nome del file (senza estensione .txt)
- Dopo aver salvato un prompt, viene automaticamente selezionato nel dropdown
- Il file input viene svuotato ma il contenuto e il nome rimangono per permettere modifiche successive

### Flusso UX migliorato
Prima:
1. Carica file → contenuto caricato
2. Devi scrivere manualmente il nome
3. Salva → lista si aggiorna ma nessun prompt selezionato
4. Devi selezionare manualmente il prompt dalla lista

Ora:
1. Carica file → contenuto caricato + nome auto-popolato dal filename
2. (Opzionale) Modifica il nome se necessario
3. Salva → lista si aggiorna + prompt appena salvato automaticamente selezionato
4. Puoi subito usarlo o fare altre operazioni

### Vantaggi
- Meno click e digitazione necessari
- Workflow più fluido e intuitivo
- Feedback visivo immediato del salvataggio
- Possibilità di modificare il prompt appena salvato senza doverlo ricercare

### File modificati
- `static/unified.js`: Aggiunto auto-popolamento nome e selezione automatica dopo save


## v0.43 (2025-10-22)
### Improvement
Rimossa gestione template duplicata e aggiunta visualizzazione template caricato nella sezione generazione

### Cosa è cambiato
- Rimossa sezione di gestione template dalla zona "Template Excel/CSV" (libreria, import, nome, salva)
- Mantenuti solo i controlli per la GENERAZIONE: metodi estrazione, prompt dimensioni opzionale, pulsante Genera
- Aggiunto banner informativo che mostra quale template è correntemente caricato
- Aggiunta lista visibile dei template disponibili nell'interfaccia unificata (modalità Template)
- Rinominato titolo sezione da "Template Excel/CSV" a "Generazione Template Excel/CSV"

### UI Template Section
Prima:
- Libreria template con dropdown e pulsanti
- Import da file
- Nome template
- Metodi estrazione
- Prompt dimensioni opzionale
- Pulsanti Salva e Genera

Ora:
- Banner verde "Template caricato: [Nome]" (quando caricato)
- Warning giallo "Nessun template caricato" (quando non caricato)
- Metodi estrazione
- Prompt dimensioni opzionale
- Solo pulsante "Genera Excel/CSV da Template"
- Gestione template spostata nella sezione "Gestione Prompt" unificata sotto

### UI Gestione Prompt Unificata (modalità Template)
- Lista visibile dei template disponibili sotto il dropdown
- Formato: box scrollabile con elenco "📋 Nome Template"
- Si aggiorna automaticamente quando si carica/salva/elimina template

### Vantaggi
- Separazione netta tra GESTIONE (sotto) e GENERAZIONE (sopra)
- Ridotto confusione UI eliminando duplicati
- Chiara visibilità del template corrente
- Lista template sempre visibile quando in modalità template

### File modificati
- `templates/unified.html`: Rimossa libreria template, aggiunta info template corrente e lista template
- `static/unified.js`: Aggiunte funzioni updateTemplateLoadedInfo() e aggiornata loadTemplatePromptsListForUnified()

### Nuove funzioni JavaScript
- `updateTemplateLoadedInfo(templateName)`: Mostra/nasconde banner template caricato nella sezione generazione


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
