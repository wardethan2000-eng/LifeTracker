import type { JSX } from "react";
import type { AssetCardData, DueItem, WorkState } from "../lib/mock-data";

const stateLabel: Record<WorkState, string> = {
  overdue: "Overdue",
  due: "Due now",
  upcoming: "Upcoming",
  clear: "Clear"
};

const toneClass: Record<WorkState, string> = {
  overdue: "is-overdue",
  due: "is-due",
  upcoming: "is-upcoming",
  clear: "is-clear"
};

const dueToneClass: Record<DueItem["state"], string> = {
  overdue: "is-overdue",
  due: "is-due",
  upcoming: "is-upcoming"
};

type AssetCardProps = {
  asset: AssetCardData;
};

export function AssetCard({ asset }: AssetCardProps): JSX.Element {
  return (
    <article className={`asset-card ${toneClass[asset.workState]}`}>
      <div className="asset-card__header">
        <div>
          <p className="asset-card__eyebrow">{asset.category}</p>
          <h3>{asset.name}</h3>
          <p className="asset-card__subtitle">{asset.subtitle}</p>
        </div>
        <span className={`status-pill ${toneClass[asset.workState]}`}>{stateLabel[asset.workState]}</span>
      </div>

      <p className="asset-card__next">{asset.nextAction}</p>

      <ul className="due-list" aria-label={`${asset.name} due work`}>
        {asset.dueItems.map((item) => (
          <li key={item.name} className="due-list__item">
            <span className={`status-dot ${dueToneClass[item.state]}`} aria-hidden="true" />
            <div>
              <strong>{item.name}</strong>
              <p>{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      <dl className="asset-metrics">
        {asset.metrics.map((metric) => (
          <div key={metric.label}>
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
          </div>
        ))}
      </dl>

      <div className="asset-card__footer">
        <p>{asset.logLine}</p>
        <div className="asset-card__actions">
          <button type="button" className="button button--primary">
            Quick log
          </button>
          <button type="button" className="button button--ghost">
            View asset
          </button>
        </div>
      </div>
    </article>
  );
}