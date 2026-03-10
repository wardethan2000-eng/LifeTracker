import type { JSX } from "react";
import { AssetCard } from "../components/asset-card";
import { assets, categories, overviewStats } from "../lib/mock-data";

const highlightedAssets = assets.filter((asset) => asset.workState === "overdue" || asset.workState === "due");

export default function HomePage(): JSX.Element {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <p className="brand-block__label">LifeKeeper</p>
          <h1>Maintenance command center</h1>
          <p>
            Asset-first planning for the work that matters now, with room for household sharing and category-specific depth.
          </p>
        </div>

        <nav className="nav-cluster" aria-label="Primary">
          <a href="#overview" className="nav-link nav-link--active">
            Home
          </a>
          <a href="#assets" className="nav-link">
            Assets
          </a>
          <a href="#categories" className="nav-link">
            Categories
          </a>
          <a href="#capture" className="nav-link">
            Add Asset
          </a>
        </nav>

        <section className="sidebar-panel">
          <p className="sidebar-panel__eyebrow">Design direction</p>
          <h2>V1 principles</h2>
          <ul>
            <li>Due work appears inside the asset context, not as a detached queue.</li>
            <li>Manual entry and presets are treated as equal setup paths.</li>
            <li>Category views can diverge later without changing the top-level navigation.</li>
          </ul>
        </section>
      </aside>

      <div className="content-column">
        <section id="overview" className="hero-panel">
          <div className="hero-panel__copy">
            <p className="section-kicker">Web prototype</p>
            <h2>Asset overview with work due pushed to the surface</h2>
            <p>
              The initial shell emphasizes the assets that need attention while keeping manual add, presets, logging, and category expansion visible in the structure.
            </p>
          </div>

          <div className="hero-panel__actions">
            <button type="button" className="button button--primary">
              Add asset manually
            </button>
            <button type="button" className="button button--ghost">
              Start from preset
            </button>
          </div>
        </section>

        <section className="stat-grid" aria-label="Overview stats">
          {overviewStats.map((stat) => (
            <article key={stat.label} className={`stat-card stat-card--${stat.tone}`}>
              <p>{stat.label}</p>
              <strong>{stat.value}</strong>
              <span>{stat.detail}</span>
            </article>
          ))}
        </section>

        <section id="assets" className="section-block">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Priority assets</p>
              <h2>Assets with due work</h2>
            </div>
            <p>These cards surface the maintenance state first, then the usage context and recent history needed to act.</p>
          </div>

          <div className="asset-grid">
            {highlightedAssets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        </section>

        <section id="categories" className="section-block section-block--split">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Category model</p>
              <h2>Categories stay visible from the start</h2>
            </div>
            <p>Each category can gain deeper detail layouts later while the shared dashboard stays coherent.</p>
          </div>

          <div className="category-grid">
            {categories.map((category) => (
              <article key={category.key} className="category-card">
                <p>{category.label}</p>
                <h3>{category.description}</h3>
                <span>Category-specific detail views can branch from this baseline.</span>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <div>
              <p className="section-kicker">All assets</p>
              <h2>Broader library view</h2>
            </div>
            <p>This lower section shows how the interface can hold stable assets without losing the emphasis on urgent work.</p>
          </div>

          <div className="asset-grid asset-grid--secondary">
            {assets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        </section>

        <section id="capture" className="capture-panel">
          <div>
            <p className="section-kicker">Capture paths</p>
            <h2>Manual entry and presets are peers</h2>
            <p>
              The first build should not force users through a library if they already know what they want to add. Both paths stay visible and equally weighted.
            </p>
          </div>

          <div className="capture-panel__actions">
            <button type="button" className="button button--primary">
              New asset form
            </button>
            <button type="button" className="button button--ghost">
              Browse preset categories
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}