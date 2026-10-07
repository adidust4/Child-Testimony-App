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
from dotenv import load_dotenv
from huggingface_hub import hf_hub_download
from transformers import RobertaTokenizer


load_dotenv()


HF_REPO_ID = "adust4/model"
MODEL_FILENAME = "model"

BASE_DIR = Path(__file__).resolve().parent
LABEL_MAPPING_PATH = BASE_DIR / "label_mapping.json"

_lock = Lock()

_nlp = None
_model = None
_tokenizer = None
_device = None


def preload_resources():
    get_nlp()
    get_model_bundle()
    load_label_mapping()


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
    # x = re.sub(r"\b[Qq]\b\s*:?", "", x)
    x = re.sub(r"\*+", "", x)
    x = re.sub(r"\([^)]*\)", "", x)

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

    x = re.sub(
        filler_pattern,
        " ",
        x,
        flags=re.IGNORECASE,
    )

    x = re.sub(
        r"\ball\s+right\b",
        " ",
        x,
        flags=re.IGNORECASE,
    )

    x = re.sub(
        r"\bthat'?s\s+right\b",
        " ",
        x,
        flags=re.IGNORECASE,
    )

    x = re.sub(
        r"^[\s,.:;!?—–-]*(?:and\b[\s,.:;!?—–-]*)+",
        "",
        x,
        flags=re.IGNORECASE,
    )

    old = None

    while old != x:
        old = x

        x = re.sub(
            r"^\s*\d+\s*",
            "",
            x,
        )

        x = re.sub(
            r"^\s*\.+\s*",
            "",
            x,
        )

        x = re.sub(
            r"^\s*\*+\s*",
            "",
            x,
        )

        x = re.sub(
            r"^\s*[Qq]\s*:?\s*",
            "",
            x,
        )

        x = re.sub(
            r"^\s*[^:]{1,40}:\s*",
            "",
            x,
        )

        x = x.strip()

    x = x.replace('"', "")
    x = re.sub(r"\s+", " ", x).strip()

    return x


def download_model():
    token = os.getenv("HF_TOKEN")

    if not token:
        raise RuntimeError(
            "HF_TOKEN environment variable is not set"
        )

    return hf_hub_download(
        repo_id=HF_REPO_ID,
        filename=MODEL_FILENAME,
        token=token,
    )


@lru_cache(maxsize=1)
def load_label_mapping():
    with open(
        LABEL_MAPPING_PATH,
        "r",
        encoding="utf-8",
    ) as f:
        mapping = json.load(f)

    return {
        int(k): v
        for k, v in mapping.items()
    }


def get_nlp():
    global _nlp

    if _nlp is None:
        with _lock:
            if _nlp is None:
                _nlp = spacy.load(
                    "en_core_web_sm"
                )

    return _nlp


def get_model_bundle():
    global _model
    global _tokenizer
    global _device

    if (
        _model is None
        or _tokenizer is None
        or _device is None
    ):
        with _lock:
            if (
                _model is None
                or _tokenizer is None
                or _device is None
            ):
                _device = torch.device(
                    "cuda"
                    if torch.cuda.is_available()
                    else "cpu"
                )

                model_path = download_model()

                _model = torch.load(
                    model_path,
                    map_location=_device,
                    weights_only=False,
                )

                _tokenizer = (
                    RobertaTokenizer.from_pretrained(
                        "roberta-base"
                    )
                )

                _model.to(_device)
                _model.eval()

    return (
        _model,
        _tokenizer,
        _device,
    )


def is_option_posing(s):
    normalized_s = s.lower().strip()

    doc = get_nlp()(normalized_s)

    tokens = normalized_s.split(" ")

    unigrams = [
        "did",
        "is",
        "does",
        "are",
        "had",
        "has",
        "have",
        "was",
        "will",
        "anybody",
    ]

    bigrams = [
        "no did",
        "anything else",
        "no is",
        "no are",
        "no have",
        "any other",
        "were there",
        "now is",
    ]

    trigrams = ["tell me if", "tell me whether"]

    quadrigrams = [
        "can you put it",
        "if someone says this",
        "do you know whether",
        "do you know if"
    ]

    if len(tokens) < 1:
        return False

    if len(tokens) == 1:
        if normalized_s in unigrams:
            return True

        return False

    if len(tokens) == 2:
        if normalized_s in bigrams:
            return True
        else:
            return False

    if len(tokens) == 3:
        if normalized_s in trigrams:
            return True
        else:
            return False


    if len(tokens) == 4:
        if normalized_s in quadrigrams:
            return True
        else:
            return False

    return False
    

def is_do_you_remember(s):
    normalized_s = s.lower().strip()

    tokens = normalized_s.split(" ")
    doc = get_nlp()(normalized_s)

    trigrams = [
        "do you know",
        "do you remember"
    ]

    quadrigrams = [
        "no do you know",
        "no do you remember",
        "do you know whether"
    ]

    if len(tokens) < 3:
        return False

    if len(tokens) == 3:
        if normalized_s in trigrams:
            return True
        elif (
            tokens[0] == "do"
            and tokens[1] == "you"
            and doc[2].pos_ == "VERB"
        ):
            return True
        else:
            return False

    if len(tokens) == 4:
        if normalized_s in quadrigrams:
            return True

        return False

    return False


def predict_turn(
    turn_text,
    model,
    tokenizer,
    device,
    label_mapping,
    is_final=False,
    space_count=0,
):
    # FINAL ANSWER

    #
    if is_final:
        encoded = tokenizer(
            turn_text,
            padding=True,
            truncation=True,
            max_length=512,
            return_tensors="pt",
        )

        input_ids = encoded[
            "input_ids"
        ].to(device)

        attention_mask = encoded[
            "attention_mask"
        ].to(device)

        with torch.no_grad():
            outputs = model(
                input_ids,
                attention_mask=attention_mask,
            )

            logits = (
                outputs.logits
                if hasattr(
                    outputs,
                    "logits",
                )
                else outputs[0]
            )

            probabilities = torch.softmax(
                logits,
                dim=1,
            )[0]

            predicted_id = int(
                torch.argmax(
                    probabilities
                ).item()
            )

            confidence = float(
                probabilities[
                    predicted_id
                ].item()
            )

        return {
            "raw_model_label": predicted_id,
            "raw_label": label_mapping[
                predicted_id
            ]["raw_label"],
            "confidence": confidence,
            "rule": None,
            "space_count": space_count,
        }


    # NON-FINAL / WHILE TYPING

    # cleaned_text = clean_question(
    #     turn_text
    # )
    cleaned_text = turn_text

    # OPTION-POSING RULE
    if is_option_posing(
        cleaned_text
    ):
        return {
            "raw_model_label": 1,
            "raw_label": label_mapping[
                1
            ]["raw_label"],
            "confidence": 1,
            "rule": "option-posing",
            "space_count": space_count,
        }

    # DO YOU KNOW / REMEMBER RULE
    if is_do_you_remember(
        cleaned_text
    ):
        return {
            "raw_model_label": 5,
            "raw_label": label_mapping[
                5
            ]["raw_label"],
            "confidence": 1,
            "rule": "do_you_remember",
            "space_count": space_count,
        }

    # NORMAL MODEL PREDICTION

    encoded = tokenizer(
        turn_text,
        padding=True,
        truncation=True,
        max_length=512,
        return_tensors="pt",
    )

    input_ids = encoded[
        "input_ids"
    ].to(device)

    attention_mask = encoded[
        "attention_mask"
    ].to(device)

    with torch.no_grad():
        outputs = model(
            input_ids,
            attention_mask=attention_mask,
        )

        logits = (
            outputs.logits
            if hasattr(
                outputs,
                "logits",
            )
            else outputs[0]
        )

        probabilities = torch.softmax(
            logits,
            dim=1,
        )[0]

        predicted_id = int(
            torch.argmax(
                probabilities
            ).item()
        )

        confidence = float(
            probabilities[
                predicted_id
            ].item()
        )

    return {
        "raw_model_label": predicted_id,
        "raw_label": label_mapping[
            predicted_id
        ]["raw_label"],
        "confidence": confidence,
        "rule": None,
        "space_count": space_count,
    }