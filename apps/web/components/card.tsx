import type { ReactNode } from "react";

type CardProps = {
  title?: string;
  actions?: ReactNode;
  headerContent?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  badge?: { count: number; variant: "danger" | "warning" };
};

export function Card({ title, actions, headerContent, children, flush, badge }: CardProps): JSX.Element {
  return (
    <div className="card">
      {title ? (
        <>
          <div className="card__header">
            <div className="card__header-left">
              <h3>{title}</h3>
              {badge && badge.count > 0 ? (
                <span className={`card__header-badge card__header-badge--${badge.variant}`}>
                  {badge.count}
                </span>
              ) : null}
            </div>
            {actions ? <div className="card__header-actions">{actions}</div> : null}
          </div>
          {headerContent}
        </>
      ) : null}
      <div className={flush ? "card__body--flush" : "card__body"}>{children}</div>
    </div>
  );
}
