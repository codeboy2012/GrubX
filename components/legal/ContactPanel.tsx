"use client";

import { type FormEvent, useEffect, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";

const contactReasons = [
  { value: "provider-report", label: "Provider report", category: "report", area: "player" },
  { value: "safety-concern", label: "Safety concern", category: "report", area: "safety" },
  { value: "bug", label: "Bug", category: "fix", area: "other" },
  { value: "feature-request", label: "Feature request", category: "add", area: "other" },
  { value: "other", label: "Other", category: "other", area: "other" },
] as const;

export function ContactPanel() {
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState<(typeof contactReasons)[number]["value"]>("provider-report");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [pageUrl, setPageUrl] = useState("");

  useEffect(() => {
    setPageUrl(`${window.location.pathname}${window.location.search}`);
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selectedReason = contactReasons.find((item) => item.value === reason) ?? contactReasons[0];

    startTransition(async () => {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          category: selectedReason.category,
          area: selectedReason.area,
          priority: selectedReason.value === "safety-concern" ? "high" : "medium",
          title,
          message,
          pageUrl,
        }),
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast.error(body?.error ?? "Could not send the message right now. Please try again later.");
        return;
      }

      toast.success("Message sent to the GrubX team.");
      setTitle("");
      setMessage("");
    });
  };

  return (
    <form onSubmit={submit} className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] px-5 py-5 md:px-6 md:py-6">
      <h2 className="text-2xl font-bold text-white">Contact GrubX Team</h2>
      <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
        Send a provider report, safety concern, bug report, feature request, or other message. This uses the existing
        server-side feedback route.
      </p>
      <div className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-semibold text-white">
          Category
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value as (typeof contactReasons)[number]["value"])}
            className="min-h-11 rounded-full border border-white/10 bg-black/40 px-4 text-sm text-white outline-none"
          >
            {contactReasons.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-white">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            required
            placeholder="Short summary"
            className="min-h-11 rounded-[0.95rem] border border-white/10 bg-black/40 px-4 text-sm text-white outline-none placeholder:text-[var(--muted)]"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-white">
          Message
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={1500}
            required
            rows={5}
            placeholder="Tell us what happened."
            className="resize-none rounded-[0.95rem] border border-white/10 bg-black/40 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-[var(--muted)]"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-white">
          Page
          <input
            value={pageUrl}
            onChange={(event) => setPageUrl(event.target.value)}
            maxLength={500}
            className="min-h-11 rounded-[0.95rem] border border-white/10 bg-black/40 px-4 text-sm text-white outline-none placeholder:text-[var(--muted)]"
          />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-black transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send className="size-4" />
          {isPending ? "Sending..." : "Send message"}
        </button>
      </div>
    </form>
  );
}
