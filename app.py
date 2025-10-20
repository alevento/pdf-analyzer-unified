from flask import Flask, render_template, request, jsonify, send_file
import pytesseract
from pdf2image import convert_from_path
from PIL import Image, ImageDraw
import cv2
import numpy as np
import os
import json
import io
import base64

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size

# Crea la cartella uploads se non esiste
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Configura il percorso di Tesseract
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# Configura il percorso di Poppler per pdf2image
poppler_path = r'C:\poppler\poppler-24.08.0\Library\bin'

def pdf_to_image(pdf_path):
    """Converte la prima pagina del PDF in immagine"""
    images = convert_from_path(pdf_path, dpi=300, first_page=1, last_page=1, poppler_path=poppler_path)
    return images[0] if images else None

def preprocess_image(image):
    """Pre-processa l'immagine per migliorare l'OCR"""
    # Converti in array numpy
    img_array = np.array(image)

    # Converti in scala di grigi
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)

    # Aumenta il contrasto usando CLAHE (Contrast Limited Adaptive Histogram Equalization)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    enhanced = clahe.apply(gray)

    # Applica denoising leggero
    denoised = cv2.fastNlMeansDenoising(enhanced, None, h=5, templateWindowSize=7, searchWindowSize=21)

    # Applica thresholding di Otsu per binarizzazione ottimale
    _, binary = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Inverti se necessario (il testo deve essere nero su sfondo bianco)
    if np.mean(binary) > 127:
        binary = cv2.bitwise_not(binary)

    # Converti in immagine PIL
    return Image.fromarray(binary)

def is_valid_text(text):
    """Verifica se il testo è valido (non solo simboli o punteggiatura)"""
    if not text or len(text.strip()) == 0:
        return False

    # Conta caratteri alfanumerici
    alphanumeric = sum(c.isalnum() for c in text)

    # Deve contenere almeno un carattere alfanumerico
    return alphanumeric > 0

def contains_numbers(text):
    """Verifica se il testo contiene almeno un numero"""
    if not text:
        return False
    return any(c.isdigit() for c in text)

def is_horizontal_text(bbox, text):
    """Verifica se il testo è orizzontale in base al rapporto larghezza/altezza"""
    width = bbox['width']
    height = bbox['height']

    # Se il bounding box ha larghezza molto minore dell'altezza, probabilmente è verticale
    # Soglia: larghezza deve essere almeno il 60% dell'altezza per testo orizzontale
    # Per singoli caratteri (come 'x'), usiamo una soglia più permissiva
    if len(text) == 1:
        # Singolo carattere: accetta se non è estremanente verticale (altezza > 3x larghezza)
        return height <= width * 3
    else:
        # Testo multiplo: deve avere larghezza ragionevole rispetto all'altezza
        return width >= height * 0.6

def merge_number_x_number(results):
    """Unisce pattern come '25', 'x', '30' in '25x30' (con o senza spazi)"""
    if len(results) < 2:
        return results

    merged = []
    i = 0

    while i < len(results):
        # Cerca pattern: numero [spazi opzionali] x [spazi opzionali] numero
        current = results[i]
        current_is_num = current['text'].replace('.', '').replace(',', '').replace('-', '').isdigit()

        if current_is_num and i < len(results) - 1:
            # Cerca 'x' nelle prossime posizioni (potrebbe essere separata da spazi)
            found_pattern = False
            j = i + 1

            # Guarda fino a 5 elementi avanti per trovare il pattern
            while j < min(len(results), i + 6):
                candidate_x = results[j]

                if candidate_x['text'].lower() == 'x':
                    # Trovato 'x', ora cerca il numero successivo
                    for k in range(j + 1, min(len(results), j + 4)):
                        candidate_num = results[k]
                        next_is_num = candidate_num['text'].replace('.', '').replace(',', '').replace('-', '').isdigit()

                        if next_is_num:
                            # Verifica che siano sulla stessa linea
                            y_tolerance = max(current['bbox']['height'], candidate_num['bbox']['height']) * 0.5
                            same_line = abs(current['bbox']['y'] - candidate_x['bbox']['y']) < y_tolerance and \
                                       abs(candidate_x['bbox']['y'] - candidate_num['bbox']['y']) < y_tolerance

                            # Verifica che siano ragionevolmente vicini orizzontalmente
                            total_gap = candidate_num['bbox']['x'] - (current['bbox']['x'] + current['bbox']['width'])
                            close_together = total_gap < 100  # Max 100 pixel di distanza totale

                            if same_line and close_together:
                                # Unisci gli elementi coinvolti
                                merged_text = f"{current['text']}x{candidate_num['text']}"

                                # Calcola bounding box unificata includendo tutti gli elementi tra current e candidate_num
                                all_elements = [current] + results[i+1:k+1]

                                min_x = min(el['bbox']['x'] for el in all_elements)
                                max_x = max(el['bbox']['x'] + el['bbox']['width'] for el in all_elements)
                                min_y = min(el['bbox']['y'] for el in all_elements)
                                max_y = max(el['bbox']['y'] + el['bbox']['height'] for el in all_elements)

                                merged_result = {
                                    'text': merged_text,
                                    'bbox': {
                                        'x': min_x,
                                        'y': min_y,
                                        'width': max_x - min_x,
                                        'height': max_y - min_y
                                    },
                                    'confidence': max(el['confidence'] for el in all_elements)
                                }

                                merged.append(merged_result)
                                i = k + 1  # Salta tutti gli elementi uniti
                                found_pattern = True
                                break

                    if found_pattern:
                        break

                j += 1

            if found_pattern:
                continue

        # Altrimenti aggiungi l'elemento corrente così com'è
        merged.append(results[i])
        i += 1

    return merged

def process_single_rotation(image, angle, label, min_conf=60):
    """Processa l'immagine con una specifica rotazione"""
    print(f"\n=== Elaborazione {label} (soglia: {min_conf}%) ===")

    # Ruota l'immagine se necessario
    if angle != 0:
        rotated_image = image.rotate(-angle, expand=True)  # PIL ruota in senso antiorario, quindi usiamo -angle
    else:
        rotated_image = image

    # Pre-processa l'immagine
    processed_image = preprocess_image(rotated_image)

    all_results = []

    # Configurazione 1: PSM 6 - Blocco uniforme di testo (per testo organizzato)
    print("Esecuzione OCR con PSM 6...")
    config1 = r'--oem 3 --psm 6'
    ocr_data1 = pytesseract.image_to_data(processed_image, lang='ita+eng',
                                          config=config1,
                                          output_type=pytesseract.Output.DICT)
    all_results.extend(parse_ocr_data(ocr_data1, min_conf=min_conf))

    # Configurazione 2: PSM 11 - Testo sparso (per numeri isolati)
    print("Esecuzione OCR con PSM 11...")
    config2 = r'--oem 3 --psm 11'
    ocr_data2 = pytesseract.image_to_data(processed_image, lang='ita+eng',
                                          config=config2,
                                          output_type=pytesseract.Output.DICT)
    all_results.extend(parse_ocr_data(ocr_data2, min_conf=min_conf))

    # Configurazione 3: PSM 3 - Auto page segmentation (default, più completo)
    print("Esecuzione OCR con PSM 3...")
    config3 = r'--oem 3 --psm 3'
    ocr_data3 = pytesseract.image_to_data(processed_image, lang='ita+eng',
                                          config=config3,
                                          output_type=pytesseract.Output.DICT)
    all_results.extend(parse_ocr_data(ocr_data3, min_conf=min_conf))

    # Filtra solo elementi che contengono numeri o 'x'
    results_with_numbers = [r for r in all_results if contains_numbers(r['text']) or r['text'].lower() == 'x']

    # Filtra solo testo orizzontale (rispetto all'immagine ruotata)
    horizontal_results = [r for r in results_with_numbers if is_horizontal_text(r['bbox'], r['text'])]

    print(f"Filtrati {len(results_with_numbers) - len(horizontal_results)} elementi verticali")

    # Rimuovi duplicati
    unique_results = remove_duplicates_simple(horizontal_results)

    # Ordina per posizione (da sinistra a destra, dall'alto in basso)
    unique_results.sort(key=lambda r: (r['bbox']['y'], r['bbox']['x']))

    # Unisci pattern "numero x numero"
    merged_results = merge_number_x_number(unique_results)

    # Filtra di nuovo per rimuovere eventuali 'x' rimasti isolati
    final_results = [r for r in merged_results if contains_numbers(r['text'])]

    # Aggiungi ID
    for idx, result in enumerate(final_results):
        result['id'] = idx

    print(f"Trovati {len(final_results)} elementi con numeri per {label}")

    # Crea immagine con i box (sull'immagine ruotata)
    img_with_boxes = draw_boxes_on_image(rotated_image, final_results)
    img_base64 = image_to_base64(img_with_boxes)

    return {
        'angle': angle,
        'label': label,
        'image': img_base64,
        'numbers': final_results,
        'count': len(final_results)
    }

def transform_bbox_from_90_to_0(bbox, rotated_width, rotated_height, original_width, original_height):
    """Trasforma le coordinate di un bbox dalla rotazione 90° a 0°"""
    # Quando ruotiamo di 90° in senso orario con PIL usando rotate(-90, expand=True):
    # L'immagine viene ruotata in senso antiorario di 90°
    # Per riportare le coordinate indietro:
    # - Un punto (x_rot, y_rot) nell'immagine ruotata
    # - Corrisponde al punto nell'originale dove:
    #   x_orig = y_rot
    #   y_orig = original_height - x_rot - w_rot (perché la rotazione inverte l'asse X)

    x_rot = bbox['x']
    y_rot = bbox['y']
    w_rot = bbox['width']
    h_rot = bbox['height']

    # Trasformazione inversa per rotazione -90° (antioraria)
    # Nell'immagine ruotata, l'asse X dell'originale è diventato l'asse Y invertito
    # L'asse Y dell'originale è diventato l'asse X

    x_orig = y_rot
    y_orig = original_height - x_rot - w_rot

    # Le dimensioni si scambiano (larghezza diventa altezza e viceversa)
    w_orig = h_rot
    h_orig = w_rot

    return {
        'x': x_orig,
        'y': y_orig,
        'width': w_orig,
        'height': h_orig
    }

def calculate_text_density_around(bbox, all_elements, radius_multiplier=3.0):
    """Calcola la densità di testo nell'area circostante un bounding box"""
    # Definisci un'area di ricerca intorno al bbox
    center_x = bbox['x'] + bbox['width'] / 2
    center_y = bbox['y'] + bbox['height'] / 2

    # Raggio di ricerca proporzionale alla dimensione del bbox
    search_radius = max(bbox['width'], bbox['height']) * radius_multiplier

    # Conta quanti elementi si trovano nell'area circostante
    nearby_count = 0
    for element in all_elements:
        elem_center_x = element['x'] + element['width'] / 2
        elem_center_y = element['y'] + element['height'] / 2

        # Calcola distanza dal centro
        distance = ((center_x - elem_center_x) ** 2 + (center_y - elem_center_y) ** 2) ** 0.5

        if distance < search_radius and distance > 0:  # Escludi l'elemento stesso
            nearby_count += 1

    return nearby_count

def filter_90deg_by_density(numbers_90deg, rotated_image, density_threshold=10):
    """Filtra i numeri da 90° rimuovendo quelli in aree con alta densità di testo"""
    # Esegui OCR completo sull'immagine ruotata per ottenere TUTTI gli elementi (non solo numeri)
    processed_image = preprocess_image(rotated_image)

    # Usa PSM 6 per ottenere una buona rilevazione generale del testo
    config = r'--oem 3 --psm 6'
    ocr_data = pytesseract.image_to_data(processed_image, lang='ita+eng',
                                         config=config,
                                         output_type=pytesseract.Output.DICT)

    # Estrai tutti gli elementi OCR (non solo numeri)
    all_elements = []
    n_boxes = len(ocr_data['text'])
    for i in range(n_boxes):
        text = ocr_data['text'][i].strip()
        if not text:
            continue

        try:
            conf = int(ocr_data['conf'][i])
        except:
            continue

        if conf < 30:  # Soglia bassa per includere più elementi
            continue

        x = ocr_data['left'][i]
        y = ocr_data['top'][i]
        w = ocr_data['width'][i]
        h = ocr_data['height'][i]

        if w < 3 or h < 3:
            continue

        all_elements.append({
            'x': x,
            'y': y,
            'width': w,
            'height': h
        })

    print(f"Trovati {len(all_elements)} elementi totali nell'immagine ruotata")

    # Filtra i numeri da 90° in base alla densità
    filtered_numbers = []
    removed_count = 0

    for num in numbers_90deg:
        # Nota: num['bbox'] è già nel sistema di coordinate dell'immagine ruotata
        # dobbiamo usare le coordinate originali prima della trasformazione
        # Per questo motivo, dobbiamo riportare indietro le coordinate

        # In realtà, numbers_90deg ha già le coordinate trasformate a 0°
        # Dobbiamo usare le coordinate originali dalla rotazione 90
        # Questo è un problema - dobbiamo passare i dati originali

        # Soluzione: passeremo i dati prima della trasformazione
        pass

    return filtered_numbers, removed_count

def remove_overlapping_rectangles(numbers_0deg, numbers_90deg):
    """Rimuove rettangoli sovrapposti, mantenendo quello con lunghezza maggiore.
    Per 0°: considera larghezza (lunghezza orizzontale)
    Per 90°: considera altezza (lunghezza verticale nella vista 0°)
    """
    filtered_0deg = []
    filtered_90deg = []

    # Controlla ogni rettangolo blu (0°) contro tutti i fucsia (90°)
    for num_0 in numbers_0deg:
        bbox_0 = num_0['bbox']
        overlaps = False

        for num_90 in numbers_90deg:
            bbox_90 = num_90['bbox']

            # Calcola intersezione
            x_overlap = max(0, min(bbox_0['x'] + bbox_0['width'], bbox_90['x'] + bbox_90['width']) -
                           max(bbox_0['x'], bbox_90['x']))
            y_overlap = max(0, min(bbox_0['y'] + bbox_0['height'], bbox_90['y'] + bbox_90['height']) -
                           max(bbox_0['y'], bbox_90['y']))

            overlap_area = x_overlap * y_overlap

            # Calcola area minima
            area_0 = bbox_0['width'] * bbox_0['height']
            area_90 = bbox_90['width'] * bbox_90['height']
            min_area = min(area_0, area_90)

            # Se c'è sovrapposizione significativa (>50% dell'area più piccola)
            if min_area > 0 and overlap_area / min_area > 0.5:
                # Lunghezza per 0°: larghezza (orizzontale)
                length_0 = bbox_0['width']
                # Lunghezza per 90°: altezza (verticale nella vista 0°)
                length_90 = bbox_90['height']

                if length_90 > length_0:
                    # Il rettangolo fucsia (90°) è più lungo, scarta quello blu
                    overlaps = True
                    break

        if not overlaps:
            filtered_0deg.append(num_0)

    # Controlla ogni rettangolo fucsia (90°) contro tutti i blu (0°) rimasti
    for num_90 in numbers_90deg:
        bbox_90 = num_90['bbox']
        overlaps = False

        for num_0 in filtered_0deg:  # Usa la lista già filtrata
            bbox_0 = num_0['bbox']

            # Calcola intersezione
            x_overlap = max(0, min(bbox_0['x'] + bbox_0['width'], bbox_90['x'] + bbox_90['width']) -
                           max(bbox_0['x'], bbox_90['x']))
            y_overlap = max(0, min(bbox_0['y'] + bbox_0['height'], bbox_90['y'] + bbox_90['height']) -
                           max(bbox_0['y'], bbox_90['y']))

            overlap_area = x_overlap * y_overlap

            # Calcola area minima
            area_0 = bbox_0['width'] * bbox_0['height']
            area_90 = bbox_90['width'] * bbox_90['height']
            min_area = min(area_0, area_90)

            # Se c'è sovrapposizione significativa
            if min_area > 0 and overlap_area / min_area > 0.5:
                # Lunghezza per 0°: larghezza
                length_0 = bbox_0['width']
                # Lunghezza per 90°: altezza
                length_90 = bbox_90['height']

                if length_0 >= length_90:
                    # Il rettangolo blu (0°) è più lungo o uguale, scarta quello fucsia
                    overlaps = True
                    break

        if not overlaps:
            filtered_90deg.append(num_90)

    return filtered_0deg, filtered_90deg

def extract_text_with_boxes(image, min_conf=60):
    """Estrae testo contenente numeri dall'immagine a 0° e 90°, unificando i risultati"""

    # Elaborazione a 0° (orizzontale)
    rotation_0_data = process_single_rotation(image, 0, '0 gradi (Orizzontale)', min_conf=min_conf)

    # Elaborazione a 90° (ruotato in senso orario)
    rotation_90_data = process_single_rotation(image, 90, '90 gradi (Verticale->Orizzontale)', min_conf=min_conf)

    # Ottieni dimensioni immagine originale e ruotata
    original_width, original_height = image.size
    rotated_image = image.rotate(-90, expand=True)
    rotated_width, rotated_height = rotated_image.size

    # Filtra i numeri da 90° in base alla densità di testo circostante
    # Prima di trasformare le coordinate
    print("\nFiltraggio elementi 90° in aree ad alta densità...")

    # Esegui OCR completo sull'immagine ruotata per ottenere TUTTI gli elementi
    processed_image = preprocess_image(rotated_image)
    config = r'--oem 3 --psm 6'
    ocr_data = pytesseract.image_to_data(processed_image, lang='ita+eng',
                                         config=config,
                                         output_type=pytesseract.Output.DICT)

    # Estrai tutti gli elementi OCR
    all_elements = []
    n_boxes = len(ocr_data['text'])
    for i in range(n_boxes):
        text = ocr_data['text'][i].strip()
        if not text:
            continue
        try:
            conf = int(ocr_data['conf'][i])
        except:
            continue
        if conf < 30:
            continue

        x = ocr_data['left'][i]
        y = ocr_data['top'][i]
        w = ocr_data['width'][i]
        h = ocr_data['height'][i]

        if w < 3 or h < 3:
            continue

        all_elements.append({'x': x, 'y': y, 'width': w, 'height': h})

    print(f"Trovati {len(all_elements)} elementi totali nell'immagine ruotata")

    # Filtra i risultati da 90° prima della trasformazione
    filtered_90_results = []
    removed_count = 0
    density_threshold = 8  # Soglia: se ci sono più di 8 elementi vicini, scarta

    for result in rotation_90_data['numbers']:
        density = calculate_text_density_around(result['bbox'], all_elements, radius_multiplier=2.5)

        if density <= density_threshold:
            filtered_90_results.append(result)
        else:
            removed_count += 1
            try:
                print(f"Rimosso '{result['text']}' (densità: {density})")
            except UnicodeEncodeError:
                print(f"Rimosso elemento (densità: {density})")

    print(f"Filtrati {removed_count} elementi da 90° in aree dense")
    print(f"Mantenuti {len(filtered_90_results)} elementi da 90°")

    # Trasforma le coordinate della rotazione 90° per riportarle a 0°
    numbers_from_90 = []
    for result in filtered_90_results:
        transformed_bbox = transform_bbox_from_90_to_0(
            result['bbox'],
            rotated_width,
            rotated_height,
            original_width,
            original_height
        )
        numbers_from_90.append({
            'text': result['text'],
            'bbox': transformed_bbox,
            'confidence': result['confidence'],
            'source': '90deg',  # Marca la provenienza
            'id': result['id']
        })

    # Aggiungi marker di provenienza anche ai numeri a 0°
    numbers_from_0 = []
    for result in rotation_0_data['numbers']:
        numbers_from_0.append({
            'text': result['text'],
            'bbox': result['bbox'],
            'confidence': result['confidence'],
            'source': '0deg',  # Marca la provenienza
            'id': result['id']
        })

    # Rimuovi sovrapposizioni tra rettangoli blu e fucsia
    print(f"\nRimozione sovrapposizioni: {len(numbers_from_0)} blu + {len(numbers_from_90)} fucsia")
    numbers_from_0_filtered, numbers_from_90_filtered = remove_overlapping_rectangles(numbers_from_0, numbers_from_90)
    removed_0 = len(numbers_from_0) - len(numbers_from_0_filtered)
    removed_90 = len(numbers_from_90) - len(numbers_from_90_filtered)
    print(f"Rimossi: {removed_0} blu, {removed_90} fucsia")
    print(f"Mantenuti: {len(numbers_from_0_filtered)} blu + {len(numbers_from_90_filtered)} fucsia")

    # Unisci tutti i numeri (usando le liste filtrate)
    all_numbers = numbers_from_0_filtered + numbers_from_90_filtered

    # Ri-assegna gli ID per evitare duplicati
    for idx, result in enumerate(all_numbers):
        result['id'] = idx

    print(f"Unificati: {len(numbers_from_0_filtered)} numeri da 0° + {len(numbers_from_90_filtered)} numeri da 90° = {len(all_numbers)} totali")

    # Crea immagine unificata con entrambi i tipi di rettangoli (usando liste filtrate)
    img_with_boxes = draw_unified_boxes(image, numbers_from_0_filtered, numbers_from_90_filtered)
    img_base64 = image_to_base64(img_with_boxes)

    # Ritorna un'unica rotazione unificata
    return [{
        'angle': 0,
        'label': 'Vista Unificata (0° + 90°)',
        'image': img_base64,
        'numbers': all_numbers,
        'count': len(all_numbers)
    }]

def draw_unified_boxes(image, numbers_0deg, numbers_90deg, highlight_id=None):
    """Disegna rettangoli blu per 0° e fucsia per 90° sull'immagine a 0°"""
    img_with_boxes = image.copy()
    draw = ImageDraw.Draw(img_with_boxes)

    # Disegna rettangoli per numeri da 0° (blu)
    for result in numbers_0deg:
        bbox = result['bbox']
        x, y, w, h = bbox['x'], bbox['y'], bbox['width'], bbox['height']
        result_id = result.get('id')

        if result_id == highlight_id:
            color = '#FFD700'  # Oro per evidenziato
            width = 5
        else:
            color = '#0066FF'  # Blu per 0°
            width = 3

        for i in range(width):
            draw.rectangle([x-i, y-i, x + w + i, y + h + i], outline=color, width=1)

    # Disegna rettangoli per numeri da 90° (fucsia)
    for result in numbers_90deg:
        bbox = result['bbox']
        x, y, w, h = bbox['x'], bbox['y'], bbox['width'], bbox['height']
        result_id = result.get('id')

        if result_id == highlight_id:
            color = '#FFD700'  # Oro per evidenziato
            width = 5
        else:
            color = '#FF00FF'  # Fucsia per 90°
            width = 3

        for i in range(width):
            draw.rectangle([x-i, y-i, x + w + i, y + h + i], outline=color, width=1)

    return img_with_boxes

def parse_ocr_data(ocr_data, min_conf=30):
    """Parsa i dati OCR e restituisce una lista di risultati"""
    results = []
    n_boxes = len(ocr_data['text'])

    for i in range(n_boxes):
        text = ocr_data['text'][i].strip()
        if not text or len(text) < 1:
            continue

        try:
            conf = int(ocr_data['conf'][i])
        except:
            continue

        if conf < min_conf:
            continue

        x = ocr_data['left'][i]
        y = ocr_data['top'][i]
        w = ocr_data['width'][i]
        h = ocr_data['height'][i]

        # Salta box troppo piccoli (probabilmente rumore)
        if w < 5 or h < 5:
            continue

        results.append({
            'text': text,
            'bbox': {
                'x': x,
                'y': y,
                'width': w,
                'height': h
            },
            'confidence': conf
        })

    return results

def remove_duplicates_simple(results):
    """Rimuove duplicati semplici basati su sovrapposizione e testo"""
    if not results:
        return []

    unique = []

    for result in results:
        is_dup = False

        for u in unique:
            # Stesso testo?
            if result['text'].lower() == u['text'].lower():
                # Calcola sovrapposizione
                b1 = result['bbox']
                b2 = u['bbox']

                x_overlap = max(0, min(b1['x']+b1['width'], b2['x']+b2['width']) - max(b1['x'], b2['x']))
                y_overlap = max(0, min(b1['y']+b1['height'], b2['y']+b2['height']) - max(b1['y'], b2['y']))

                overlap_area = x_overlap * y_overlap
                area1 = b1['width'] * b1['height']
                area2 = b2['width'] * b2['height']

                if area1 > 0 and overlap_area / area1 > 0.5:
                    is_dup = True
                    # Mantieni quello con confidenza maggiore
                    if result['confidence'] > u['confidence']:
                        u['confidence'] = result['confidence']
                        u['bbox'] = result['bbox']
                    break

        if not is_dup:
            unique.append(result)

    return unique

def remove_duplicates(results):
    """Rimuove duplicati basandosi su testo simile e posizione vicina"""
    if not results:
        return []

    unique_results = []

    for result in results:
        is_duplicate = False

        for unique in unique_results:
            # Verifica se il testo è simile (stesso testo)
            text_match = result['text'].lower() == unique['text'].lower()

            # Verifica se le bounding box si sovrappongono o sono molto vicine
            bbox1 = result['bbox']
            bbox2 = unique['bbox']

            # Calcola l'intersezione
            x1_min, y1_min = bbox1['x'], bbox1['y']
            x1_max, y1_max = x1_min + bbox1['width'], y1_min + bbox1['height']
            x2_min, y2_min = bbox2['x'], bbox2['y']
            x2_max, y2_max = x2_min + bbox2['width'], y2_min + bbox2['height']

            # Area di intersezione
            x_overlap = max(0, min(x1_max, x2_max) - max(x1_min, x2_min))
            y_overlap = max(0, min(y1_max, y2_max) - max(y1_min, y2_min))
            overlap_area = x_overlap * y_overlap

            # Area delle bounding box
            area1 = bbox1['width'] * bbox1['height']
            area2 = bbox2['width'] * bbox2['height']

            # Calcola la percentuale di sovrapposizione
            if area1 > 0 and area2 > 0:
                overlap_ratio = overlap_area / min(area1, area2)

                # Se il testo è uguale e c'è sovrapposizione > 30%, è un duplicato
                if text_match and overlap_ratio > 0.3:
                    is_duplicate = True
                    # Mantieni quello con confidenza maggiore
                    if result['confidence'] > unique['confidence']:
                        unique['confidence'] = result['confidence']
                        unique['bbox'] = result['bbox']
                        unique['orientation'] = result['orientation']
                    break

        if not is_duplicate:
            unique_results.append(result)

    return unique_results

def draw_boxes_on_image(image, ocr_results, highlight_id=None):
    """Disegna i bounding box sull'immagine con rettangoli evidenti"""
    img_with_boxes = image.copy()
    draw = ImageDraw.Draw(img_with_boxes)

    for idx, result in enumerate(ocr_results):
        bbox = result['bbox']
        x, y, w, h = bbox['x'], bbox['y'], bbox['width'], bbox['height']

        result_id = result.get('id', idx)

        if result_id == highlight_id:
            # Elemento evidenziato: giallo brillante con bordo spesso
            color = '#FFD700'  # Oro
            width = 5

            # Disegna un rettangolo di sfondo semi-trasparente
            # (simulato con rettangolo bianco)
            for i in range(width):
                draw.rectangle([x-i, y-i, x + w + i, y + h + i], outline=color, width=1)
        else:
            # Elementi normali: blu elettrico più spesso
            color = '#0066FF'  # Blu elettrico
            width = 3

            # Disegna il rettangolo con bordo spesso
            for i in range(width):
                draw.rectangle([x-i, y-i, x + w + i, y + h + i], outline=color, width=1)

    return img_with_boxes

def image_to_base64(image):
    """Converte un'immagine PIL in base64"""
    buffered = io.BytesIO()
    image.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    return f"data:image/png;base64,{img_str}"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'Nessun file caricato'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'Nessun file selezionato'}), 400

    if not file.filename.lower().endswith('.pdf'):
        return jsonify({'error': 'Il file deve essere un PDF'}), 400

    # Leggi la soglia di confidenza (default 60)
    try:
        confidence_threshold = int(request.form.get('confidence_threshold', 60))
        # Limita il valore tra 0 e 100
        confidence_threshold = max(0, min(100, confidence_threshold))
    except ValueError:
        confidence_threshold = 60

    print(f"Soglia di confidenza impostata: {confidence_threshold}%")

    try:
        # Salva il file
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], 'current.pdf')
        file.save(filepath)

        # Converti PDF in immagine
        image = pdf_to_image(filepath)
        if not image:
            return jsonify({'error': 'Impossibile convertire il PDF'}), 500

        # Salva l'immagine originale
        original_path = os.path.join(app.config['UPLOAD_FOLDER'], 'original.png')
        image.save(original_path)

        # Estrai numeri con tutte le rotazioni usando la soglia specificata
        all_rotations = extract_text_with_boxes(image, min_conf=confidence_threshold)

        # Salva i risultati
        results_path = os.path.join(app.config['UPLOAD_FOLDER'], 'ocr_results.json')
        with open(results_path, 'w', encoding='utf-8') as f:
            json.dump(all_rotations, f, ensure_ascii=False, indent=2)

        return jsonify({
            'success': True,
            'rotations': all_rotations
        })

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"ERROR: {error_details}")
        return jsonify({'error': f'Errore durante l\'elaborazione: {str(e)}'}), 500

@app.route('/highlight/<int:item_id>/<int:rotation_index>')
def highlight_item(item_id, rotation_index):
    """Evidenzia un elemento specifico sull'immagine unificata"""
    try:
        # Carica l'immagine originale
        original_path = os.path.join(app.config['UPLOAD_FOLDER'], 'original.png')
        image = Image.open(original_path)

        # Carica i risultati OCR
        results_path = os.path.join(app.config['UPLOAD_FOLDER'], 'ocr_results.json')
        with open(results_path, 'r', encoding='utf-8') as f:
            all_rotations = json.load(f)

        # Ottieni la rotazione unificata (ora c'è solo una)
        if rotation_index >= len(all_rotations):
            return jsonify({'error': 'Indice rotazione non valido'}), 400

        rotation = all_rotations[rotation_index]
        all_numbers = rotation['numbers']

        # Separa i numeri per source (0deg e 90deg)
        numbers_0deg = [n for n in all_numbers if n.get('source') == '0deg']
        numbers_90deg = [n for n in all_numbers if n.get('source') == '90deg']

        # Disegna i box unificati con evidenziazione
        img_with_boxes = draw_unified_boxes(image, numbers_0deg, numbers_90deg, highlight_id=item_id)
        img_base64 = image_to_base64(img_with_boxes)

        return jsonify({
            'success': True,
            'image': img_base64
        })

    except Exception as e:
        import traceback
        print(f"Errore highlight: {traceback.format_exc()}")
        return jsonify({'error': f'Errore: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
