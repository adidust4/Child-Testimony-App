"use client";

import {
  type ChangeEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { addDoc, collection } from "firebase/firestore";

import styles from "../page.module.css";
import { db } from "../../lib/firebase";

type Prediction = {
  raw_label: string;
  confidence?: number;
  raw_model_label?: number;
  rule?: string;
};

type PredictionTrigger =
  | "space"
  | "space-deleted"
  | "enter/button";

const countSpaces = (value: string) =>
  (value.match(/ /g) || []).length;

export default function PredictionClient() {
  const searchParams = useSearchParams();
  const name = searchParams.get("text") ?? "";

  const [text, setText] = useState("");
  const [prediction, setPrediction] =
    useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPrediction, setShowPrediction] =
    useState(false);
  const [scenario, setScenario] = useState(1);
  const [needsNewScenario, setNeedsNewScenario] =
    useState(false);

  const predictionRequestId = useRef(0);

  const API_URL =
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8000";

  const logToFirebase = async (
    question: string,
    predictionData: Prediction,
    isFinal: boolean,
    predictionShown: boolean,
    trigger: PredictionTrigger
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
    } catch (error) {
      console.error("Error adding document:", error);
    }
  };

  const getPrediction = async (
    question: string,
    isFinal: boolean,
    trigger: PredictionTrigger
  ) => {
    const requestId = ++predictionRequestId.current;

    if (!question.trim()) {
      setPrediction(null);
      setShowPrediction(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const spaceCount = countSpaces(question);

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

      if (!response.ok) {
        throw new Error(
          `Prediction request failed: ${response.status}`
        );
      }

      const data: Prediction = await response.json();

      if (requestId !== predictionRequestId.current) {
        return;
      }

      const shouldShow =
        data.raw_label === "not a question"
          ? isFinal
          : isFinal ||
            (data.raw_label === "option-posing" && data.rule !== null) ||
            (data.raw_label === "do you know / remember" && data.rule !== null) ||
            spaceCount >= 4;
      setPrediction(data);
      setShowPrediction(shouldShow);

      await logToFirebase(
        question,
        data,
        isFinal,
        shouldShow,
        trigger
      );

      if (
        isFinal &&
        requestId === predictionRequestId.current
      ) {
        setNeedsNewScenario(true);
      }
    } catch (error) {
      if (requestId === predictionRequestId.current) {
        console.error("Prediction error:", error);
      }
    } finally {
      if (requestId === predictionRequestId.current) {
        setLoading(false);
      }
    }
  };

  const handleTextChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const newText = event.target.value;
    const previousSpaceCount = countSpaces(text);
    const newSpaceCount = countSpaces(newText);
  
    setText(newText);
  
    if (newSpaceCount > previousSpaceCount) {
      getPrediction(newText, false, "space");
    } else if (newSpaceCount < previousSpaceCount) {
      getPrediction(newText, false, "space-deleted");
    }
  };

  const handleNextScenario = () => {
    if (!needsNewScenario || scenario >= 44) {
      return;
    }

    predictionRequestId.current += 1;

    setScenario((currentScenario) => currentScenario + 1);
    setText("");
    setPrediction(null);
    setShowPrediction(false);
    setLoading(false);
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

    const spaceCount = countSpaces(text);

    if (
      !needsNewScenario &&
      spaceCount >= 4 &&
      (prediction.raw_label === "tag")
    ) {
      return {
        color: "#ffffff",
        emoji: "",
        message: "Type a question",
      };
    }

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
        return {
          color: "#ff2400",
          emoji: "😠",
          message: prediction.raw_label,
        };

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
      
        case "do you know / remember":
          return {
            color: "#e5de00",
            emoji: "😑",
            message: prediction.raw_label,
          };

      default:
        return {
          color: "#ffffff",
          emoji: "",
          message: "Type a question",
        };
    }
  }, [
    prediction,
    showPrediction,
    text,
    needsNewScenario,
  ]);

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
          onChange={handleTextChange}
          placeholder="Type your question here..."
          disabled={needsNewScenario}
          onKeyDown={(event) => {
            if (needsNewScenario) {
              return;
            }

            if (event.key === "Enter") {
              event.preventDefault();

              getPrediction(
                event.currentTarget.value,
                true,
                "enter/button"
              );
            }
          }}
          onKeyUp={(event) => {
            if (
              needsNewScenario ||
              event.code !== "Space"
            ) {
              return;
            }

            getPrediction(
              event.currentTarget.value,
              false,
              "space"
            );
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