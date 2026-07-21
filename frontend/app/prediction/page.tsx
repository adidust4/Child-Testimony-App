"use client";

import { useMemo, useState, useEffect } from "react";
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
  measurementId: "G-DFVSN43M9J"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


type Prediction = {
  raw_label: string;
};

export default function Page() {
  const searchParams = useSearchParams();
  const name = searchParams.get("text") ?? "";
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
    
    try {
      const docRef = addDoc (collection(db, "Responses"), {
        answer_final: false,
        current_answer: text,
        id: name,
        prediction_shown: true,
        scenario: 0
      });
    } catch (e) {
      console.error("Error adding document: ", e);
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

      <div className={styles.selectRow}>
        <span>Scenario Number:</span>
        <select className={styles.select}>
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
        onKeyDown={(e) => {
          if (e.key === "Enter" || "Space") getPrediction(text);
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