from pathlib import Path
import json
import re
import os
import unicodedata
import spacy
import string
import pandas as pd
import torch
from transformers import RobertaTokenizer
from huggingface_hub import hf_hub_download


HF_REPO_ID = "adust4/model"

MODEL_FILENAME = "model"

nlp = spacy.load("en_core_web_sm")


def clean_question(x):
    if pd.isna(x):
        return ""

    x = str(x)

    # Normalize unicode
    x = unicodedata.normalize("NFKC", x)

    # Remove invisible characters
    x = re.sub(r"[\u200b\u200c\u200d\ufeff]", "", x)

    # Remove weird encoding artifact
    x = x.replace("Ã‚Â", "")

    # Normalize whitespace
    x = re.sub(r"\s+", " ", x).strip()

    # If there is an opening quote, keep what comes after it
    x = re.sub(r'^[^"]*"', "", x)

    # Remove bracketed text anywhere, e.g. [pause], [...]
    x = re.sub(r"\[[^\]]*\]", "", x)

    # Remove random numbers anywhere in the string
    x = re.sub(r"\b\d+\b", "", x)

    # Remove Q anywhere as its own token
    x = re.sub(r"\b[Qq]\b\s*:?", "", x)

    # Remove asterisks anywhere
    x = re.sub(r"\*+", "", x)

    # Remove parenthesized text anywhere, e.g. (pause), (unclear)
    x = re.sub(r"\([^)]*\)", "", x)

    # Clean beginning artifacts repeatedly
    old = None
    while old != x:
        old = x
        x = re.sub(r"^\s*\d+\s*", "", x)
        x = re.sub(r"^\s*\.+\s*", "", x)
        x = re.sub(r"^\s*\*+\s*", "", x)
        x = re.sub(r"^\s*[Qq]\s*:?\s*", "", x)
        x = re.sub(r"^\s*[^:]{1,40}:\s*", "", x)
        x = x.strip()

    # Remove all double quotes
    x = x.replace('"', "")

    # Remove common discourse markers / fillers
    filler_pattern = (
        r"\b(?:"
        r"uh+|um+|hm+|mm+|"
        r"oh+|"
        r"ok+|okay+|mk|"
        r"yeah+|yea+h*|yep+|"
        r"so+|"
        r"huh+"
        r")\b"
    )


    x = re.sub(filler_pattern, " ", x, flags=re.IGNORECASE)
    x = re.sub(r"\ball\s+right\b", " ", x, flags=re.IGNORECASE)
    x = re.sub(r"\bthat'?s\s+right\b", " ", x, flags=re.IGNORECASE)
    x = re.sub(
        r"^[\s,.:;!?—–-]*(?:and\b[\s,.:;!?—–-]*)+",
        "",
        x,
        flags=re.IGNORECASE
    )


    # Final whitespace cleanup
    x = re.sub(r"\s+", " ", x).strip()

    return x

BASE_DIR = Path(__file__).resolve().parent
LABEL_MAPPING_PATH = BASE_DIR / "label_mapping.json"

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

def is_option_posing(s):
    normalized_s = s.lower().strip()
    doc = nlp(normalized_s)
    tokens = normalized_s.split(" ")
    if len(tokens) < 2:
        return False
    elif len(tokens) == 2:
        if normalized_s == "will you":
            return True
        elif normalized_s == "have you":
            return True
        elif normalized_s == "is there":
            return True
        elif normalized_s == "no did":
            return True
        elif tokens[0] == "do" and doc[1].lemma_ == "PRON":
                    return True
        else:
            return False
    elif len(tokens) == 3:
        if tokens[0] == "do" and doc[1].lemma_ == "PRON" and doc[2].lemma_ == "VERB" and tokens[2] not in ["know", "remember"]:
            return True
        elif tokens[0] == "you" and tokens[1] == "said" and tokens[2] == "you":
            return True
        else:
            return False
    elif len(tokens) == 4:
        if tokens[0] == "can" and tokens[1] == "you" and tokens[2] == "put" and tokens[3] == "it":
            return True
        elif tokens[0] == "are" and tokens[1] == "you" and tokens[2] == "going" and tokens[3] == "to":
            return True
        elif tokens[0] == "if" and tokens[1] == "someone" and tokens[2] == "says" and tokens[3] == "this":
            return True
        else:
            return False
    else:
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
    else:
        cleaned_text = clean_question(turn_text)
        is_option = is_option_posing(cleaned_text)
        if is_option:
            return {
                "raw_model_label": 1,
                "raw_label": label_mapping[1]["raw_label"],
                "confidence": 1,
            }
        else:
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