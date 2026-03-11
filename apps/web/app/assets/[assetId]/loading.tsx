import type { JSX } from "react";

export default function AssetDetailLoading(): JSX.Element {
  return (
    <div className="skeleton-page">
      <div className="detail-topbar">
        <div className="skeleton-bar" style={{ width: 120, height: 18 }} />
      </div>
      <div className="detail-body">
        <section className="detail-hero">
          <div className="detail-hero__info">
            <div className="skeleton-bar" style={{ width: 80, height: 12, marginBottom: 8 }} />
            <div className="skeleton-bar" style={{ width: 240, height: 28, marginBottom: 8 }} />
            <div className="skeleton-bar" style={{ width: 180, height: 16 }} />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="detail-hero__meta-item">
                <div className="skeleton-bar" style={{ width: 60, height: 12, marginBottom: 4 }} />
                <div className="skeleton-bar" style={{ width: 40, height: 18 }} />
              </div>
            ))}
          </div>
        </section>
        <div className="detail-layout">
          <div className="detail-column">
            <div className="panel">
              <div className="panel__header"><div className="skeleton-bar" style={{ width: 140, height: 20 }} /></div>
              <div style={{ padding: 20 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton-bar" style={{ width: "100%", height: 44, marginBottom: 12, borderRadius: 8 }} />
                ))}
              </div>
            </div>
            <div className="panel">
              <div className="panel__header"><div className="skeleton-bar" style={{ width: 180, height: 20 }} /></div>
              <div style={{ padding: 20 }}>
                {[1, 2].map((i) => (
                  <div key={i} className="skeleton-bar" style={{ width: "100%", height: 80, marginBottom: 12, borderRadius: 8 }} />
                ))}
              </div>
            </div>
          </div>
          <div className="detail-column">
            <div className="panel">
              <div className="panel__header"><div className="skeleton-bar" style={{ width: 120, height: 20 }} /></div>
              <div style={{ padding: 20 }}>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="skeleton-bar" style={{ width: "100%", height: 36, marginBottom: 12, borderRadius: 8 }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
