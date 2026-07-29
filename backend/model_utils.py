# model_utils.py
from pathlib import Path
import json
import os
import re
import unicodedata
from functools import lru_cache
from threading import Lock

import pandas as pd
import spacy
import torch
from huggingface_hub import hf_hub_download
from transformers import RobertaTokenizer

HF_REPO_ID = "adust4/model"
MODEL_FILENAME = "model"

BASE_DIR = Path(__file__).resolve().parent
LABEL_MAPPING_PATH = BASE_DIR / "label_mapping.json"

_lock = Lock()
_nlp = None
_model = None
_tokenizer = None
_device = None


def clean_question(x):
    if pd.isna(x):
        return ""

    x = str(x)
    x = unicodedata.normalize("NFKC", x)
    x = re.sub(r"[\u200b\u200c\u200d\ufeff]", "", x)
    x = x.replace("Ã‚Â", "")
    x = re.sub(r"\s+", " ", x).strip()
    x = re.sub(r'^[^"]*"', "", x)
    x = re.sub(r"\[[^\]]*\]", "", x)
    x = re.sub(r"\b\d+\b", "", x)
    x = re.sub(r"\b[Qq]\b\s*:?", "", x)
    x = re.sub(r"\*+", "", x)
    x = re.sub(r"\([^)]*\)", "", x)

    old = None
    while old != x:
        old = x
        x = re.sub(r"^\s*\d+\s*", "", x)
        x = re.sub(r"^\s*\.+\s*", "", x)
        x = re.sub(r"^\s*\*+\s*", "", x)
        x = re.sub(r"^\s*[Qq]\s*:?\s*", "", x)
        x = re.sub(r"^\s*[^:]{1,40}:\s*", "", x)
        x = x.strip()

    x = x.replace('"', "")
    x = re.sub(r"\s+", " ", x).strip()
    return x


def download_model():
    token = os.getenv("HF_TOKEN")
    if not token:
        raise RuntimeError("HF_TOKEN environment variable is not set")

    return hf_hub_download(
        repo_id=HF_REPO_ID,
        filename=MODEL_FILENAME,
        token=token,
    )


@lru_cache(maxsize=1)
def load_label_mapping():
    with open(LABEL_MAPPING_PATH, "r", encoding="utf-8") as f:
        mapping = json.load(f)
    return {int(k): v for k, v in mapping.items()}


def get_nlp():
    global _nlp
    if _nlp is None:
        with _lock:
            if _nlp is None:
                _nlp = spacy.load("en_core_web_sm")
    return _nlp


def get_model_bundle():
    global _model, _tokenizer, _device
    if _model is None or _tokenizer is None or _device is None:
        with _lock:
            if _model is None or _tokenizer is None or _device is None:
                _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
                model_path = download_model()

                _model = torch.load(
                    model_path,
                    map_location=_device,
                    weights_only=False,
                )
                _tokenizer = RobertaTokenizer.from_pretrained("roberta-base")
                _model.to(_device)
                _model.eval()

    return _model, _tokenizer, _device


def is_option_posing(s):
    normalized_s = s.lower().strip()
    doc = get_nlp()(normalized_s)
    tokens = normalized_s.split(" ")

    if len(tokens) < 2:
        return False
    if len(tokens) == 2:
        if normalized_s in {"will you", "have you", "is there", "no did"}:
            return True
        if tokens[0] == "do" and doc[1].pos_ == "PRON":
            return True
        return False
    if len(tokens) == 3:
        if tokens[0] == "do" and doc[1].pos_ == "PRON" and doc[2].pos_ == "VERB" and tokens[2] not in ["know", "remember"]:
            return True
        if tokens[0] == "you" and tokens[1] == "said" and tokens[2] == "you":
            return True
        return False
    if len(tokens) == 4:
        if tokens[0] == "can" and tokens[1] == "you" and tokens[2] == "put" and tokens[3] == "it":
            return True
        if tokens[0] == "are" and tokens[1] == "you" and tokens[2] == "going" and tokens[3] == "to":
            return True
        if tokens[0] == "if" and tokens[1] == "someone" and tokens[2] == "says" and tokens[3] == "this":
            return True
        return False
    return False


def predict_turn(turn_text, model, tokenizer, device, label_mapping, is_final=False):
    if is_final:
        encoded = tokenizer(
            turn_text,
            padding=True,
            truncation=True,
            max_length=512,
            return_tensors="pt",
        )
        input_ids = encoded["input_ids"].to(device)
        attention_mask = encoded["attention_mask"].to(device)

        with torch.no_grad():
            outputs = model(input_ids, attention_mask=attention_mask)
            logits = outputs.logits if hasattr(outputs, "logits") else outputs[0]
            probabilities = torch.softmax(logits, dim=1)[0]
            predicted_id = int(torch.argmax(probabilities).item())
            confidence = float(probabilities[predicted_id].item())

        return {
            "raw_model_label": predicted_id,
            "raw_label": label_mapping[predicted_id]["raw_label"],
            "confidence": confidence,
        }

    cleaned_text = clean_question(turn_text)
    if is_option_posing(cleaned_text):
        return {
            "raw_model_label": 1,
            "raw_label": label_mapping[1]["raw_label"],
            "confidence": 1,
        }

    encoded = tokenizer(
        turn_text,
        padding=True,
        truncation=True,
        max_length=512,
        return_tensors="pt",
    )
    input_ids = encoded["input_ids"].to(device)
    attention_mask = encoded["attention_mask"].to(device)

    with torch.no_grad():
        outputs = model(input_ids, attention_mask=attention_mask)
        logits = outputs.logits if hasattr(outputs, "logits") else outputs[0]
        probabilities = torch.softmax(logits, dim=1)[0]
        predicted_id = int(torch.argmax(probabilities).item())
        confidence = float(probabilities[predicted_id].item())

    return {
        "raw_model_label": predicted_id,
        "raw_label": label_mapping[predicted_id]["raw_label"],
        "confidence": confidence,
    }