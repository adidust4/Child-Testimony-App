from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

from model_utils import (
    predict_turn,
    model,
    tokenizer,
    device,
    label_mapping,
)

app = FastAPI()

origins = [
    "http://localhost:8081",      # Expo web (common)
    "http://localhost:19006",     # Older Expo web port
    "http://localhost:3000",      # If using React dev server
    "https://adidust4.github.io",
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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