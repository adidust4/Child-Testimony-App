"use client";

import { useMemo, useState } from "react";
import styles from "../page.module.css";
import { useSearchParams } from "next/navigation";
import { initializeApp } from "firebase/app";
import { collection, addDoc, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAIXWf0aObW_SFs32e8n6_Mn59PK9ZsBls",
  authDomain: "child-testimony.firebaseapp.com",
  projectId: "child-testimony",
  storageBucket: "child-testimony.firebasestorage.app",
  messagingSenderId: "980904584345",
  appId: "1:980904584345:web:c76323f02b08d2412b0408",
  measurementId: "G-DFVSN43M9J",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

type Prediction = {
  raw_label: string;
  confidence?: number;
  raw_model_label?: number;
};

export default function PredictionClient() {
  const searchParams = useSearchParams();
  const name = searchParams.get("text") ?? "";

  const [text, setText] = useState("");
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPrediction, setShowPrediction] = useState(false);
  const [scenario, setScenario] = useState(1);
  const [needsNewScenario, setNeedsNewScenario] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  const logToFirebase = async (
    question: string,
    predictionData: Prediction,
    isFinal: boolean,
    predictionShown: boolean
  ) => {
    try {
      await addDoc(collection(db, "Responses"), {
        answer_final: isFinal,
        prediction_shown: predictionShown,
        current_answer: question,
        id: name,
        prediction_label: predictionData.raw_label,
        scenario,
        trigger: isFinal ? "enter/button" : "space",
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  };

  const getPrediction = async (question: string, isFinal: boolean) => {
    if (!question.trim()) {
      setPrediction(null);
      setShowPrediction(false);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: question,
          is_final: isFinal,
        }),
      });

      const data: Prediction = await response.json();
      setPrediction(data);

      const shouldShow = isFinal || data.raw_label === "option-posing";
      setShowPrediction(shouldShow);

      await logToFirebase(question, data, isFinal, shouldShow);

      if (isFinal) {
        setNeedsNewScenario(true);
      }
    } catch (e) {
      console.error("Prediction error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleScenarioChange = (value: number) => {
    setScenario(value);

    if (needsNewScenario) {
      setText("");
      setPrediction(null);
      setShowPrediction(false);
      setNeedsNewScenario(false);
    }
  };

  const status = useMemo(() => {
    if (!prediction || !showPrediction) {
      return {
        color: "#ffffff",
        emoji: "",
      };
    }

    switch (prediction.raw_label) {
      case "wh-question / directive":
        return { color: "#9ae474", emoji: "🙂" };

      case "invitation":
        return { color: "#9ae474", emoji: "😁" };

      case "tag":
      case "option-posing":
        return { color: "#ff2400", emoji: "😠" };

      case "not a question":
        return { color: "#e5de00", emoji: "😑" };

      default:
        return { color: "#e5de00", emoji: "🤔" };
    }
  }, [prediction, showPrediction]);

  return (
    <main className={styles.page} style={{ backgroundColor: status.color }}>
      <div className={styles.card}>
        {status.emoji && <div className={styles.emoji}>{status.emoji}</div>}

        <h1 className={styles.title}>
          {showPrediction && prediction ? prediction.raw_label : "Type a question"}
        </h1>

        <div className={styles.selectRow}>
          <span>Scenario Number:</span>
          <select
            className={styles.select}
            value={scenario}
            onChange={(e) => handleScenarioChange(Number(e.target.value))}
          >
            {[...Array(44)].map((_, i) => i + 1).map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>

        <input
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your question here..."
          disabled={needsNewScenario}
          onKeyDown={(e) => {
            if (needsNewScenario) return;

            if (e.key === "Enter") {
              getPrediction(text, true);
            } else if (e.code === "Space") {
              getPrediction(text, false);
            }
          }}
        />

        <button
          className={styles.button}
          onClick={() => {
            if (!needsNewScenario) {
              getPrediction(text, true);
            }
          }}
          disabled={needsNewScenario || loading}
        >
          {loading
            ? "Predicting..."
            : needsNewScenario
              ? "Please select a new scenario"
              : "Predict Question Type"}
        </button>
      </div>
    </main>
  );
}