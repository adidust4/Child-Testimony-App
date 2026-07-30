import { Suspense } from "react";
import FullPredictionClient from "./fullPredictionClient";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <FullPredictionClient />
    </Suspense>
  );
}