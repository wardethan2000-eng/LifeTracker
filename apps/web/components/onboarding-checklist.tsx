"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveLayoutPreference } from "../lib/api";

type ChecklistStep = {
  id: string;
  label: string;
  description: string;
  href: string;
  completed: boolean;
};

type OnboardingChecklistProps = {
  assetCount: number;
  householdId: string;
  projectCount: number;
  hobbyCount: number;
  inventoryItemCount: number;
  ideaCount: number;
  entryCount: number;
  maintenanceScheduleCount: number;
  onDismiss: () => void;
};

export function OnboardingChecklist({
  assetCount,
  projectCount,
  hobbyCount,
  inventoryItemCount,
  ideaCount,
  entryCount,
  maintenanceScheduleCount,
  onDismiss,
}: OnboardingChecklistProps) {
  const steps: ChecklistStep[] = [
    {
      id: "create-asset",
      label: "Create your first asset",
      description: "Register a physical item and set up its maintenance schedules.",
      href: "/assets/new",
      completed: assetCount > 0,
    },
    {
      id: "maintenance-schedule",
      label: "Set up a maintenance schedule",
      description: "Define recurring tasks to keep your assets in top shape.",
      href: "/maintenance",
      completed: maintenanceScheduleCount > 0,
    },
    {
      id: "start-project",
      label: "Start a project",
      description: "Plan work with phases, tasks, budgets, and timelines.",
      href: "/projects/new",
      completed: projectCount > 0,
    },
    {
      id: "pick-hobby",
      label: "Pick up a hobby",
      description: "Track sessions, recipes, gear, and progress for any pursuit.",
      href: "/hobbies/new",
      completed: hobbyCount > 0,
    },
    {
      id: "add-inventory",
      label: "Add an inventory item",
      description: "Keep stock of consumables, supplies, and spare parts.",
      href: "/inventory",
      completed: inventoryItemCount > 0,
    },
    {
      id: "capture-idea",
      label: "Capture an idea",
      description: "Jot down a raw idea before you lose it — promote it later.",
      href: "/ideas/new",
      completed: ideaCount > 0,
    },
    {
      id: "write-note",
      label: "Write a note",
      description: "Record observations, reminders, or logs against any entity.",
      href: "/notes",
      completed: entryCount > 0,
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const total = steps.length;

  if (completedCount === total) return null;

  const progressPct = Math.round((completedCount / total) * 100);

  return (
    <div className="onboarding-checklist">
      <div className="onboarding-checklist__header">
        <div className="onboarding-checklist__title-row">
          <h2 className="onboarding-checklist__title">Getting started</h2>
          <span className="onboarding-checklist__count">
            {completedCount} / {total} completed
          </span>
        </div>
        <div className="onboarding-checklist__progress-bar" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="onboarding-checklist__progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <ul className="onboarding-checklist__steps">
        {steps.map((step) => (
          <li
            key={step.id}
            className={`onboarding-checklist__step${step.completed ? " onboarding-checklist__step--done" : ""}`}
          >
            <div className="onboarding-checklist__check" aria-hidden="true" />
            <div className="onboarding-checklist__step-body">
              <Link href={step.href} className="onboarding-checklist__step-label text-link">
                {step.label}
              </Link>
              <span className="onboarding-checklist__step-desc">{step.description}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="onboarding-checklist__footer">
        <button
          type="button"
          className="button button--ghost"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

type OnboardingChecklistClientProps = Omit<OnboardingChecklistProps, "onDismiss">;

export function OnboardingChecklistClient(props: OnboardingChecklistClientProps) {
  const router = useRouter();

  async function handleDismiss() {
    await saveLayoutPreference({
      entityType: "onboarding",
      entityId: "dismissed",
      layoutJson: [],
    });
    router.refresh();
  }

  return <OnboardingChecklist {...props} onDismiss={handleDismiss} />;
}
