import Link from "next/link";
import type { JSX } from "react";

type LaunchPadAction = {
  href: string;
  title: string;
  description: string;
  icon: JSX.Element;
  tone: string;
};

const actions: LaunchPadAction[] = [
  {
    href: "/ideas/new",
    title: "Ideate",
    description: "Capture a raw idea, jot notes, and list what you might need.",
    tone: "ideate",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
      </svg>
    ),
  },
  {
    href: "/assets/new",
    title: "Create",
    description: "Register a new asset and set up its maintenance schedules.",
    tone: "create",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
  {
    href: "/projects/new",
    title: "Plan",
    description: "Start a project with phases, tasks, budget, and a timeline.",
    tone: "plan",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  {
    href: "/maintenance",
    title: "Maintain",
    description: "Review what's due and log completed maintenance work.",
    tone: "maintain",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    href: "/hobbies/new",
    title: "Pursue",
    description: "Pick up a hobby and track sessions, recipes, or progress.",
    tone: "pursue",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 3h15" />
        <path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3" />
        <path d="M6 14h12" />
      </svg>
    ),
  },
  {
    href: "/notes",
    title: "Journal",
    description: "Write a note, log an observation, or set a reminder for later.",
    tone: "journal",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
];

export function LaunchPad(): JSX.Element {
  return (
    <section className="launch-pad">
      <div className="launch-pad__header">
        <h2>What would you like to do?</h2>
        <p>Pick a starting point — you can always change direction later.</p>
      </div>
      <div className="launch-pad__grid">
        {actions.map((action) => (
          <Link
            key={action.title}
            href={action.href}
            className={`launch-pad__card launch-pad__card--${action.tone}`}
          >
            <div className="launch-pad__icon">{action.icon}</div>
            <div className="launch-pad__content">
              <strong className="launch-pad__title">{action.title}</strong>
              <span className="launch-pad__desc">{action.description}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
