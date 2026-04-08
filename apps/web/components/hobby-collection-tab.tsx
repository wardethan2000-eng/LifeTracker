"use client";

import type { HobbyActivityMode, HobbyCollectionItem, HobbyCollectionItemStatus } from "@aegis/types";
import Link from "next/link";
import { useMemo, useState, type JSX } from "react";
import { useFormattedDate } from "../lib/formatted-date";

type HobbyCollectionTabProps = {
  hobbyId: string;
  activityMode: HobbyActivityMode;
  items: HobbyCollectionItem[];
};

type SortValue = "name" | "acquired" | "status";

function statusClass(status: HobbyCollectionItemStatus): string {
  switch (status) {
    case "active":
      return "pill pill--success";
    case "dormant":
      return "pill pill--warning";
    case "retired":
      return "pill pill--muted";
    case "lost":
      return "pill pill--danger";
    case "deceased":
      return "pill pill--danger";
    default:
      return "pill";
  }
}

export function HobbyCollectionTab({ hobbyId, activityMode, items }: HobbyCollectionTabProps): JSX.Element {
  const { formatDate } = useFormattedDate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<HobbyCollectionItemStatus | "all">("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortValue>("name");

  const locations = useMemo(() => Array.from(new Set(items.map((item) => item.location).filter((value): value is string => Boolean(value)))).sort(), [items]);
  const tags = useMemo(() => Array.from(new Set(items.flatMap((item) => item.tags))).sort(), [items]);

  const visibleItems = useMemo(() => {
    const filtered = items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (locationFilter !== "all" && item.location !== locationFilter) return false;
      if (tagFilter !== "all" && !item.tags.includes(tagFilter)) return false;
      if (search.trim().length > 0 && !item.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });

    return filtered.sort((left, right) => {
      if (sort === "name") return left.name.localeCompare(right.name);
      if (sort === "status") return left.status.localeCompare(right.status) || left.name.localeCompare(right.name);
      return new Date(right.acquiredDate ?? 0).getTime() - new Date(left.acquiredDate ?? 0).getTime();
    });
  }, [items, locationFilter, search, sort, statusFilter, tagFilter]);

  return (
    <div className="mode-workspace">
      <section className="panel panel--studio">
        <div className="panel__header mode-workspace__header">
          <div>
            <h2>Collection</h2>
            <p className="mode-workspace__subcopy">Organize specimens, variants, or collectible pieces with care history and item-specific metrics.</p>
          </div>
          <div className="mode-workspace__header-meta">
            {activityMode === "collection" ? <span className="pill pill--info">Primary mode</span> : null}
            <span className="pill">{items.length} items</span>
          </div>
        </div>
        <div className="section-filter__bar section-filter__bar--dense">
          <label className="section-filter__field section-filter__field--wide">
            <span>Search</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by item name" />
          </label>
          <label className="section-filter__field">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as HobbyCollectionItemStatus | "all")}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="dormant">Dormant</option>
              <option value="retired">Retired</option>
              <option value="lost">Lost</option>
              <option value="deceased">Deceased</option>
            </select>
          </label>
          <label className="section-filter__field">
            <span>Location</span>
            <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
              <option value="all">All locations</option>
              {locations.map((location) => <option key={location} value={location}>{location}</option>)}
            </select>
          </label>
          <label className="section-filter__field">
            <span>Tag</span>
            <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
              <option value="all">All tags</option>
              {tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </label>
          <label className="section-filter__field">
            <span>Sort</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortValue)}>
              <option value="name">Name</option>
              <option value="acquired">Acquired date</option>
              <option value="status">Status</option>
            </select>
          </label>
        </div>
        <div className="panel__body--padded">
          {visibleItems.length === 0 ? <p className="panel__empty">No collection items match the current filters.</p> : (
            <div className="collection-grid">
              {visibleItems.map((item) => {
                const customFieldPreview = Object.entries(item.customFields).slice(0, 3);
                return (
                  <Link key={item.id} href={`/hobbies/${hobbyId}/collection/${item.id}`} className="collection-card">
                    {item.coverImageUrl ? (
                      <div className="collection-card__media">
                        <img src={item.coverImageUrl} alt="" />
                      </div>
                    ) : null}
                    <div className="collection-card__body">
                      <div className="mode-list-card__header">
                        <div>
                          <h3>{item.name}</h3>
                          <p>{item.description ?? "No description provided."}</p>
                        </div>
                        <span className={statusClass(item.status)}>{item.status}</span>
                      </div>
                      <div className="mode-list-card__meta">
                        <span>{item.location ?? "No location"}</span>
                        <span>Acquired {formatDate(item.acquiredDate)}</span>
                        <span>Qty {item.quantity}</span>
                      </div>
                      {customFieldPreview.length > 0 ? (
                        <dl className="mode-kv-list">
                          {customFieldPreview.map(([key, value]) => (
                            <div key={key}>
                              <dt>{key}</dt>
                              <dd>{String(value)}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                      {item.tags.length > 0 ? (
                        <div className="mode-tag-row">
                          {item.tags.map((tag) => <span key={tag} className="pill pill--muted">{tag}</span>)}
                        </div>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}