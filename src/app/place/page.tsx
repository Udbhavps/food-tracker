import { Suspense } from "react";
import { PlaceScreen } from "./place-screen";

export const metadata = { title: "Place" };

export default function PlacePage() {
  // useSearchParams needs a Suspense boundary under cache components.
  return (
    <Suspense fallback={null}>
      <PlaceScreen />
    </Suspense>
  );
}
