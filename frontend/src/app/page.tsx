import { AuthGate } from "@/components/AuthGate";

// A Server Component (no "use client"): it just renders the interactive app.
export default function Home() {
  return <AuthGate />;
}
