"use client";

import { useMemo, useState } from "react";
import styles from "../page.module.css";
import { useSearchParams } from "next/navigation";
import { collection, addDoc } from "firebase/firestore";



import { db } from "../../lib/firebase";


type Prediction = {
raw_label: string;
confidence?: number;
raw_model_label?: number;
};

export default function FullPredictionClient() {
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
predictionShown: boolean,
trigger: "space" | "enter/button"
) => {
try {
await addDoc(collection(db, "Responses"), {
answer_final: isFinal,
prediction_shown: predictionShown,
current_answer: question,
id: name,
prediction_label: predictionData.raw_label,
scenario,
trigger,
timestamp: new Date().toISOString(),
});
} catch (e) {
console.error("Error adding document: ", e);
}
};

const getPrediction = async (
question: string,
isFinal: boolean,
trigger: "space" | "enter/button"
) => {
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

  // Only show the prediction on Enter or button submit
  const shouldShow = isFinal;
  setShowPrediction(shouldShow);

  await logToFirebase(question, data, isFinal, shouldShow, trigger);

  if (isFinal) {
    setNeedsNewScenario(true);
  }
} catch (e) {
  console.error("Prediction error:", e);
} finally {
  setLoading(false);
}

};

const handleNextScenario = () => {
  if (!needsNewScenario || scenario >= 44) return;

  setScenario((prev) => prev + 1);
  setText("");
  setPrediction(null);
  setShowPrediction(false);
  setNeedsNewScenario(false);
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
      <strong>{scenario}</strong>
    </div>

    <button
      className={styles.button}
      onClick={handleNextScenario}
      disabled={!needsNewScenario || scenario >= 44}
      style={{ marginBottom: "12px" }}
    >
      {scenario >= 44
        ? "All Scenarios Complete"
        : "Next Scenario"}
    </button>

    <input
      className={styles.input}
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder="Type your question here..."
      disabled={needsNewScenario}
      onKeyDown={(e) => {
        if (needsNewScenario) return;

        if (e.key === "Enter") {
          e.preventDefault();
          getPrediction(text, true, "enter/button");
        } else if (e.code === "Space") {
          getPrediction(text, false, "space");
        }
      }}
    />

    <button
      className={styles.button}
      onClick={() => {
        if (!needsNewScenario) {
          getPrediction(text, true, "enter/button");
        }
      }}
      disabled={needsNewScenario || loading}
    >
      {loading
        ? "Predicting..."
        : needsNewScenario
          ? "Please move to the next scenario"
          : "Predict Question Type"}
    </button>
  </div>
</main>

);
}