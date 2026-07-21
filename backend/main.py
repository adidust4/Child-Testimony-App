from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from model_utils import (
    predict_turn,
    model,
    tokenizer,
    device,
    label_mapping,
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://adidust4.github.io",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Question(BaseModel):
    text: str


@app.post("/predict")
def predict(question: Question):
    result = predict_turn(
        question.text,
        model,
        tokenizer,
        device,
        label_mapping,
    )

    return result