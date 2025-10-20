// ============================================================================
// DIMENSION EXTRACTION PROMPT MANAGEMENT
// ============================================================================

let currentDimensionPrompt = null;

// Add event listeners for dimension prompt functionality in DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    const dimensionPromptInput = document.getElementById('dimensionPromptInput');
    if (dimensionPromptInput) {
        dimensionPromptInput.addEventListener('input', handleDimensionPromptInput);
    }

    // Add file upload listener for dimension prompts
    const dimensionPromptFileInput = document.getElementById('dimensionPromptFileInput');
    if (dimensionPromptFileInput) {
        dimensionPromptFileInput.addEventListener('change', handleDimensionPromptFileUpload);
    }

    // Load saved dimension prompts on page load
    loadDimensionPromptsList();
});

function handleDimensionPromptInput() {
    const dimensionPromptInput = document.getElementById('dimensionPromptInput');
    const dimensionStatus = document.getElementById('dimensionStatus');
    const extractBtn = document.getElementById('extractDimensionsBtn');
    const saveBtn = document.getElementById('saveDimensionPromptBtn');

    if (dimensionPromptInput.value.trim()) {
        currentDimensionPrompt = dimensionPromptInput.value.trim();
        extractBtn.disabled = false;
        saveBtn.disabled = false;
        dimensionStatus.textContent = '';
    } else {
        currentDimensionPrompt = null;
        extractBtn.disabled = true;
        saveBtn.disabled = true;
        dimensionStatus.textContent = '';
    }
}

async function extractDimensions() {
    if (!currentDimensionPrompt) {
        alert('Scrivi prima un prompt per l\'estrazione dimensioni');
        return;
    }

    if (!currentPageImage) {
        alert('Carica prima un PDF');
        return;
    }

    const dimensionStatus = document.getElementById('dimensionStatus');
    const extractBtn = document.getElementById('extractDimensionsBtn');
    const textList = document.getElementById('textList');

    extractBtn.disabled = true;
    dimensionStatus.textContent = '⏳ Estrazione in corso...';
    textList.innerHTML = '<div class="ai-loading">📐 Estrazione dimensioni con Claude Opus...</div>';

    // Hide download buttons for dimension extraction (text-based)
    document.getElementById('downloadButtons').style.display = 'none';
    currentDisplayData = null;

    try {
        const response = await fetch('/extract_dimensions', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                prompt: currentDimensionPrompt,
                image: currentPageImage
            })
        });

        const data = await response.json();

        if (data.error) {
            textList.innerHTML = `<div class="ai-error"><strong>Errore:</strong> ${data.error}</div>`;
            dimensionStatus.textContent = '❌ Errore estrazione';
        } else if (data.success && data.dimensions) {
            textList.innerHTML = `
                <div class="ai-result">
                    <h3>📐 Dimensioni Estratte</h3>
                    <div class="ai-result-item">
                        <pre>${escapeHtml(data.dimensions)}</pre>
                    </div>
                </div>
            `;
            dimensionStatus.textContent = '✓ Estrazione completata';
            status.textContent = 'Estrazione dimensioni completata';
        }
    } catch (error) {
        textList.innerHTML = `<div class="ai-error"><strong>Errore:</strong> ${error.message}</div>`;
        dimensionStatus.textContent = '❌ Errore connessione';
        status.textContent = 'Errore estrazione dimensioni';
    } finally {
        extractBtn.disabled = false;
    }
}

// ============================================================================
// DIMENSION PROMPT LIBRARY MANAGEMENT
// ============================================================================

async function loadDimensionPromptsList() {
    try {
        const response = await fetch('/get_dimension_prompts');
        if (response.ok) {
            const data = await response.json();
            const select = document.getElementById('savedDimensionPromptsSelect');

            // Clear existing options except first
            select.innerHTML = '<option value="">-- Seleziona un prompt --</option>';

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
        console.error('Error loading dimension prompts:', error);
    }
}

async function saveCurrentDimensionPrompt() {
    const promptName = document.getElementById('dimensionPromptNameInput').value.trim();
    const dimensionStatus = document.getElementById('dimensionStatus');

    if (!promptName) {
        alert('Inserisci un nome per il prompt');
        return;
    }

    if (!currentDimensionPrompt) {
        alert('Scrivi prima un prompt');
        return;
    }

    try {
        dimensionStatus.textContent = '⏳ Salvataggio in corso...';

        const response = await fetch('/save_dimension_prompt', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                name: promptName,
                content: currentDimensionPrompt
            })
        });

        const data = await response.json();

        if (data.success) {
            dimensionStatus.textContent = `✓ Prompt "${promptName}" salvato`;

            // Reload prompts list
            await loadDimensionPromptsList();

            // Clear inputs
            document.getElementById('dimensionPromptNameInput').value = '';
        } else {
            dimensionStatus.textContent = '❌ ' + (data.error || 'Errore salvataggio');
        }
    } catch (error) {
        dimensionStatus.textContent = '❌ Errore connessione';
        console.error('Error saving dimension prompt:', error);
    }
}

async function loadSavedDimensionPrompt() {
    const select = document.getElementById('savedDimensionPromptsSelect');
    const promptId = select.value;
    const dimensionStatus = document.getElementById('dimensionStatus');

    if (!promptId) {
        alert('Seleziona un prompt dalla lista');
        return;
    }

    try {
        dimensionStatus.textContent = '⏳ Caricamento...';

        const response = await fetch(`/get_dimension_prompt/${promptId}`);
        const data = await response.json();

        if (data.success) {
            currentDimensionPrompt = data.prompt.content;
            document.getElementById('dimensionPromptInput').value = currentDimensionPrompt;
            document.getElementById('dimensionPromptNameInput').value = data.prompt.name;
            document.getElementById('extractDimensionsBtn').disabled = false;
            document.getElementById('saveDimensionPromptBtn').disabled = false;
            dimensionStatus.textContent = `✓ Prompt "${data.prompt.name}" caricato`;
        } else {
            dimensionStatus.textContent = '❌ ' + (data.error || 'Errore caricamento');
        }
    } catch (error) {
        dimensionStatus.textContent = '❌ Errore connessione';
        console.error('Error loading dimension prompt:', error);
    }
}

async function deleteSavedDimensionPrompt() {
    const select = document.getElementById('savedDimensionPromptsSelect');
    const promptId = select.value;
    const dimensionStatus = document.getElementById('dimensionStatus');

    if (!promptId) {
        alert('Seleziona un prompt da eliminare');
        return;
    }

    const promptName = select.options[select.selectedIndex].text;

    if (!confirm(`Vuoi eliminare il prompt "${promptName}"?`)) {
        return;
    }

    try {
        dimensionStatus.textContent = '⏳ Eliminazione...';

        const response = await fetch(`/delete_dimension_prompt/${promptId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            dimensionStatus.textContent = `✓ Prompt "${promptName}" eliminato`;

            // Reload prompts list
            await loadDimensionPromptsList();

            // Clear current prompt if it was the deleted one
            if (document.getElementById('dimensionPromptNameInput').value === promptName) {
                currentDimensionPrompt = null;
                document.getElementById('dimensionPromptInput').value = '';
                document.getElementById('dimensionPromptNameInput').value = '';
                document.getElementById('extractDimensionsBtn').disabled = true;
                document.getElementById('saveDimensionPromptBtn').disabled = true;
            }
        } else {
            dimensionStatus.textContent = '❌ ' + (data.error || 'Errore eliminazione');
        }
    } catch (error) {
        dimensionStatus.textContent = '❌ Errore connessione';
        console.error('Error deleting dimension prompt:', error);
    }
}

// ============================================================================
// FILE UPLOAD AND DOWNLOAD FUNCTIONS
// ============================================================================

function handleDimensionPromptFileUpload(event) {
    const file = event.target.files[0];
    const dimensionStatus = document.getElementById('dimensionStatus');

    if (!file) return;

    if (!file.name.endsWith('.txt')) {
        alert('Seleziona un file .txt');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        document.getElementById('dimensionPromptInput').value = content;
        currentDimensionPrompt = content;

        // Enable buttons
        document.getElementById('extractDimensionsBtn').disabled = false;
        document.getElementById('saveDimensionPromptBtn').disabled = false;

        // Auto-fill name from filename
        const fileName = file.name.replace('.txt', '');
        document.getElementById('dimensionPromptNameInput').value = fileName;

        dimensionStatus.textContent = `✓ File "${file.name}" caricato`;

        // Clear file input
        event.target.value = '';
    };

    reader.onerror = function() {
        dimensionStatus.textContent = '❌ Errore lettura file';
        event.target.value = '';
    };

    reader.readAsText(file);
}

async function downloadDimensionPrompt() {
    const select = document.getElementById('savedDimensionPromptsSelect');
    const promptId = select.value;
    const dimensionStatus = document.getElementById('dimensionStatus');

    if (!promptId) {
        alert('Seleziona un prompt da scaricare');
        return;
    }

    try {
        dimensionStatus.textContent = '⏳ Download...';

        const response = await fetch(`/get_dimension_prompt/${promptId}`);
        const data = await response.json();

        if (data.success) {
            const prompt = data.prompt;
            const blob = new Blob([prompt.content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${prompt.name}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            dimensionStatus.textContent = `✓ Download "${prompt.name}.txt" completato`;
        } else {
            dimensionStatus.textContent = '❌ ' + (data.error || 'Errore download');
        }
    } catch (error) {
        dimensionStatus.textContent = '❌ Errore connessione';
        console.error('Error downloading dimension prompt:', error);
    }
}
