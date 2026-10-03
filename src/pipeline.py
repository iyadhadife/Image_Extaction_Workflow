import base64
import json

from groq import Groq

from src.llm_engine import analyse_image
from src.utils import clean_json_output

OCR_MODEL = "easyocr"
VISION_MODELS = [
    "qwen/qwen3.8-27b",
]


def _parse_json(raw_text):
    cleaned = clean_json_output(raw_text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {"error": "JSON invalide", "raw": raw_text}


# run the extraction of one image and return the parsed JSON (dict or list)
def extract_document(img_bytes, model, api_key, schema_json=None):
    if not img_bytes:
        raise ValueError("Fichier vide")

    # case easyocr: brut ocr then structure the text with an llm
    if model == OCR_MODEL:
        from src.ocr_engine import get_reader, process_with_easyocr, parse_ocr_with_llm

        try:
            get_reader()
        except ImportError as e:
            raise RuntimeError("EasyOCR n'est pas installé (pip install easyocr)") from e

        raw_text, boxes = process_with_easyocr(img_bytes)
        if not boxes:
            # process_with_easyocr returns an error message with no boxes on failure
            raise RuntimeError(raw_text.strip() or "EasyOCR n'a détecté aucun texte dans l'image")
        print(f"Texte OCR ({len(boxes)} blocs): {raw_text[:300]!r}")
        json_str = parse_ocr_with_llm(raw_text, client_groq=Groq(api_key=api_key), schema_json=schema_json)
        return _parse_json(json_str)

    # case llm vision: streaming aggregation
    encoded_image = base64.b64encode(img_bytes).decode("utf-8")
    stream = analyse_image(image=encoded_image, model=model, GROQ_API_KEY=api_key, schema_json=schema_json)
    full_raw_result = "".join(chunk.choices[0].delta.content or "" for chunk in stream)
    return _parse_json(full_raw_result)
