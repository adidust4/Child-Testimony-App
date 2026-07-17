"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

type Prediction = {
  raw_label: string;
};

export default function Page() {
  const [text, setText] = useState("");
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const getPrediction = async (question: string) => {
    if (!question.trim()) {
      setPrediction(null);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: question }),
      });

      const data = await response.json();
      setPrediction(data);
    } finally {
      setLoading(false);
    }
  };

  const status = useMemo(() => {
    if (!prediction)
      return {
        color: "#9ae474",
        emoji: "😁",
      };

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
  }, [prediction]);

  return (
    <main
      className={styles.page}
      style={{ backgroundColor: status.color }}
    >
      <div className={styles.card}>
        <div className={styles.emoji}>{status.emoji}</div>

        <h1 className={styles.title}>
          {prediction ? prediction.raw_label : "Type a question"}
        </h1>

        <input
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your question here..."
          onKeyDown={(e) => {
            if (e.key === "Enter") getPrediction(text);
          }}
        />

        <button
          className={styles.button}
          onClick={() => getPrediction(text)}
        >
          {loading ? "Predicting..." : "Predict Question Type"}
        </button>
      </div>
    </main>
  );
}