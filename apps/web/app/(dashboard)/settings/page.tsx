import type { JSX } from "react";
import { ThemeToggle } from "../../../components/theme-toggle";

export default async function UserSettingsPage(): Promise<JSX.Element> {
  return (
    <>
      <header className="page-header">
        <div>
          <h1>User Settings</h1>
          <p>Personal interface preferences for this browser.</p>
        </div>
      </header>

      <div className="page-body">
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>Appearance</h2>
              <p className="data-table__secondary">Choose between light and dark mode.</p>
            </div>
          </div>
          <div className="panel__body--padded">
            <ThemeToggle />
          </div>
        </section>
      </div>
    </>
  );
}