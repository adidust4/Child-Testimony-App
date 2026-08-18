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

export default function PredictionClient() {
  const searchParams = useSearchParams();
  const name = searchParams.get("text") ?? "";

  const [text, setText] = useState("");
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPrediction, setShowPrediction] = useState(false);
  const [scenario, setScenario] = useState(1);
  const [needsNewScenario, setNeedsNewScenario] = useState(false);

  const API_URL =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  const logToFirebase = async (
    question: string,
    predictionData: Prediction,
    isFinal: boolean,
    predictionShown: boolean,
    trigger: "space" | "enter/button",
    spaceCount: number
  ) => {
    try {
      await addDoc(collection(db, "Responses"), {
        answer_final: isFinal,
        prediction_shown: predictionShown,
        current_answer: question,
        id: name,
        prediction_label: predictionData.raw_label,
        space_count: spaceCount,
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
      // Includes the space that was just pressed
      const spaceCount = (question.match(/ /g) || []).length;

      const response = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: question,
          is_final: isFinal,
          space_count: spaceCount,
        }),
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(
          `Backend returned ${response.status}: ${responseText}`
        );
      }

      const data: Prediction = JSON.parse(responseText);

      setPrediction(data);

      /*
       * Show feedback:
       *
       * 1. Always show final predictions.
       *
       * 2. While typing, after 5 words / 4 spaces,
       *    show feedback if the prediction is:
       *       - tag
       *       - not a question
       */
      const shouldShow =
        isFinal ||
        (spaceCount >= 4 &&
          (data.raw_label === "tag" ||
            data.raw_label === "not a question"));

      setShowPrediction(shouldShow);

      await logToFirebase(
        question,
        data,
        isFinal,
        shouldShow,
        trigger,
        spaceCount
      );

      if (isFinal) {
        setNeedsNewScenario(true);
      }
    } catch (e) {
      console.error("Prediction error:", e);
      setPrediction(null);
      setShowPrediction(false);
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
        message: "Type a question",
      };
    }

    /*
     * While the user is still typing:
     *
     * TAG or NOT A QUESTION
     * = yellow warning screen
     */
    if (
      !needsNewScenario &&
      (prediction.raw_label === "tag" ||
        prediction.raw_label === "not a question")
    ) {
      return {
        color: "#fff176",
        emoji: "⚠️",
        message:
          "Watch out! Looks like a close-ended question!",
      };
    }

    /*
     * Final prediction after Enter/button
     */
    switch (prediction.raw_label) {
      case "wh-question / directive":
        return {
          color: "#9ae474",
          emoji: "🙂",
          message: prediction.raw_label,
        };

      case "invitation":
        return {
          color: "#9ae474",
          emoji: "😁",
          message: prediction.raw_label,
        };

      case "tag":
      case "option-posing":
        return {
          color: "#ff2400",
          emoji: "😠",
          message: prediction.raw_label,
        };

      case "not a question":
        return {
          color: "#e5de00",
          emoji: "😑",
          message: prediction.raw_label,
        };

      default:
        return {
          color: "#e5de00",
          emoji: "🤔",
          message: prediction.raw_label,
        };
    }
  }, [prediction, showPrediction, needsNewScenario]);

  return (
    <main
      className={styles.page}
      style={{ backgroundColor: status.color }}
    >
      <div className={styles.card}>
        {status.emoji && (
          <div className={styles.emoji}>
            {status.emoji}
          </div>
        )}

        <h1 className={styles.title}>
          {status.message}
        </h1>

        <div className={styles.selectRow}>
          <span>Scenario Number:</span>
          <strong>{scenario}</strong>
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
              e.preventDefault();

              getPrediction(
                e.currentTarget.value,
                true,
                "enter/button"
              );
            } else if (e.code === "Space") {
              e.preventDefault();

              /*
               * onKeyDown happens before the browser
               * adds the newly pressed space.
               *
               * Add it manually so space_count
               * includes the new space.
               */
              const questionWithNewSpace =
                e.currentTarget.value + " ";

              setText(questionWithNewSpace);

              getPrediction(
                questionWithNewSpace,
                false,
                "space"
              );
            }
          }}
        />

        <button
          className={styles.button}
          onClick={() => {
            if (!needsNewScenario) {
              getPrediction(
                text,
                true,
                "enter/button"
              );
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

        <button
          className={styles.button}
          onClick={handleNextScenario}
          disabled={
            !needsNewScenario || scenario >= 44
          }
          style={{ marginBottom: "12px" }}
        >
          {scenario >= 44
            ? "All Scenarios Complete"
            : "Next Scenario"}
        </button>
      </div>
    </main>
  );
}