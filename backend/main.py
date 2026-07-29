# main.py
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from model_utils import (
    predict_turn,
    get_model_bundle,
    load_label_mapping,
    preload_resources,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    preload_resources()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://adidust4.github.io",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Question(BaseModel):
    text: str
    is_final: bool = False


@app.get("/")
def root():
    return {"status": "ok"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/predict")
def predict(question: Question):
    model, tokenizer, device = get_model_bundle()
    label_mapping = load_label_mapping()

    return predict_turn(
        question.text,
        model,
        tokenizer,
        device,
        label_mapping,
        is_final=question.is_final,
    )