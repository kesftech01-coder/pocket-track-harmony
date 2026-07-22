import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const teacher = localStorage.getItem("pt.teacher");
    throw redirect({ to: teacher ? "/dashboard" : "/auth" });
  },
  ssr: false,
  component: () => null,
});
