"use client";

import { AuthProvider } from "../components/AuthProvider";
import AppShell from "../components/AppShell";

export default function HomePage() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
