import type { Project } from "@lifekeeper/types";

type ProjectCoreFormFieldsProps = {
  householdId: string;
  project?: Project;
  includeProjectId?: boolean;
};

const projectStatusOptions = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" }
] as const;

const toDateInputValue = (value: string | null | undefined): string => value ? value.slice(0, 10) : "";

export function ProjectCoreFormFields({
  householdId,
  project,
  includeProjectId = false
}: ProjectCoreFormFieldsProps) {
  return (
    <>
      <input type="hidden" name="householdId" value={householdId} />
      {includeProjectId && project ? <input type="hidden" name="projectId" value={project.id} /> : null}

      <div className="form-grid">
        <div className="field field--full">
          <label htmlFor="project-name">Project Name</label>
          <input id="project-name" name="name" defaultValue={project?.name ?? ""} placeholder="Kitchen refresh, roof replacement, spring maintenance" required />
        </div>

        <div className="field field--full">
          <label htmlFor="project-description">Description</label>
          <textarea
            id="project-description"
            name="description"
            rows={3}
            defaultValue={project?.description ?? ""}
            placeholder="Scope, intent, or expected outcome"
          />
        </div>

        <div className="field">
          <label htmlFor="project-status">Status</label>
          <select id="project-status" name="status" defaultValue={project?.status ?? "planning"}>
            {projectStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="project-budget">Budget</label>
          <input id="project-budget" name="budgetAmount" type="number" min="0" step="0.01" defaultValue={project?.budgetAmount ?? ""} placeholder="0.00" />
        </div>

        <div className="field">
          <label htmlFor="project-start-date">Start Date</label>
          <input id="project-start-date" name="startDate" type="date" defaultValue={toDateInputValue(project?.startDate)} />
        </div>

        <div className="field">
          <label htmlFor="project-target-end-date">Target End Date</label>
          <input id="project-target-end-date" name="targetEndDate" type="date" defaultValue={toDateInputValue(project?.targetEndDate)} />
        </div>

        <div className="field field--full">
          <label htmlFor="project-notes">Notes</label>
          <textarea
            id="project-notes"
            name="notes"
            rows={4}
            defaultValue={project?.notes ?? ""}
            placeholder="Dependencies, purchase plans, constraints, vendor notes"
          />
        </div>
      </div>
    </>
  );
}