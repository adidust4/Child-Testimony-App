from pathlib import Path
import json
import re
import os

import pandas as pd
import torch
from transformers import RobertaTokenizer

from huggingface_hub import hf_hub_download


HF_REPO_ID = "adust4/model"

MODEL_FILENAME = "model"


def clean_question(x):
    if pd.isna(x):
        return ""

    x = str(x)

    x = unicodedata.normalize("NFKC", x)

    x = re.sub(r"[\u200b\u200c\u200d\ufeff]", "", x)

    x = re.sub(r"\s+", " ", x).strip()

    x = re.sub(r'^[^"]*"', "", x)

    old = None
    while old != x:
        old = x
        x = re.sub(r"^\s*\d+\s*", "", x)              # number
        x = re.sub(r"^\s*\.+\s*", "", x)              # .
        x = re.sub(r"^\s*\*+\s*", "", x)              # *
        x = re.sub(r"^\s*[Qq]\s*:?\s*", "", x)        # Q or Q:
        x = re.sub(r"^\s*[^:]{1,40}:\s*", "", x)      # speaker tag
        x = x.strip()

    x = re.sub(r'"$', "", x).strip()

    return x

BASE_DIR = Path(__file__).resolve().parent
LABEL_MAPPING_PATH = BASE_DIR / "previous" / "label_mapping.json"

def download_model():

    token = os.getenv("HF_TOKEN")

    return hf_hub_download(
        repo_id=HF_REPO_ID,
        filename=MODEL_FILENAME,
        token=token,
    )

def load_label_mapping():
    with open(LABEL_MAPPING_PATH, "r", encoding="utf-8") as f:
        mapping = json.load(f)
    return {int(k): v for k, v in mapping.items()}

def load_model():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    MODEL_PATH = download_model()

    model = torch.load(
        MODEL_PATH,
        map_location=device,
        weights_only=False
    )

    tokenizer = RobertaTokenizer.from_pretrained("roberta-base")

    model.to(device)
    model.eval()

    return model, tokenizer, device

def predict_turn(turn_text, model, tokenizer, device, label_mapping):
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

def split_words(sentence):
    return re.findall(r"\S+", str(sentence))

label_mapping = load_label_mapping()
model, tokenizer, device = load_model()