"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [text, setText] = useState("");
  const router = useRouter();

  const handleClick = () => {
    if (!text.trim()) {
      alert("Please enter your assigned ID.");
      return;
    }

    router.push(`/prediction?text=${encodeURIComponent(text)}`);
  };

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "20px",
      }}
    >
      <h1>Child Interviewing</h1>
      <p>Welcome! Please enter your ID below.</p>

      <input
        type="text"
        placeholder="Type your ID..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{
          padding: "12px",
          width: "350px",
          fontSize: "16px",
          borderRadius: "8px",
          border: "1px solid #ccc",
        }}
      />

      <button
        onClick={handleClick}
        style={{
          padding: "12px 24px",
          fontSize: "16px",
          cursor: "pointer",
          borderRadius: "8px",
          border: "none",
          backgroundColor: "#0070f3",
          color: "white",
        }}
      >
        Start Asking Questions
      </button>
    </main>
  );
}