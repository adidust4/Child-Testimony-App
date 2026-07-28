import { Suspense } from "react";
import PredictionClient from "./PredictionClient";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PredictionClient />
    </Suspense>
  );
}