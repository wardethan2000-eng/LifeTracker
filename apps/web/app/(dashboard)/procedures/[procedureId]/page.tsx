import Link from "next/link";
import type { JSX } from "react";
import { Suspense } from "react";
import { ApiError, getProcedure, getMe } from "../../../../lib/api";
import { PageHeader } from "../../../../components/page-header";
import { ProcedureDetailClient } from "../../../../components/procedure-detail-client";

type ProcedureDetailPageProps = {
  params: Promise<{ procedureId: string }>;
};

async function ProcedureContent({ householdId, procedureId }: { householdId: string; procedureId: string }): Promise<JSX.Element> {
  let procedure;
  try {
    procedure = await getProcedure(householdId, procedureId);
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded"><p>Failed to load procedure: {error.message}</p></div>
        </div>
      );
    }
    throw error;
  }

  return (
    <>
      <section className="panel">
        <div className="panel__header">
          <h2>{procedure.title}</h2>
          <div style={{ display: "flex", gap: 8 }}>
            {procedure.estimatedMinutes && <span className="pill pill--muted">~{procedure.estimatedMinutes} min</span>}
            <span className="pill pill--info">v{procedure.version}</span>
          </div>
        </div>
        {procedure.description && (
          <div className="panel__body--padded">
            <p>{procedure.description}</p>
          </div>
        )}
      </section>

      <ProcedureDetailClient householdId={householdId} procedureId={procedureId} procedure={procedure} />
    </>
  );
}

export default async function ProcedureDetailPage({ params }: ProcedureDetailPageProps): Promise<JSX.Element> {
  const { procedureId } = await params;
  const me = await getMe();
  const household = me.households[0];

  if (!household) {
    return <p>No household found.</p>;
  }

  return (
    <>
      <PageHeader
        title="Procedure Detail"
        actions={<Link href="/procedures" className="button button--ghost button--sm">← All Procedures</Link>}
      />
      <div className="page-body">
        <Suspense fallback={<div className="panel"><div className="panel__body--padded"><p className="note">Loading…</p></div></div>}>
          <ProcedureContent householdId={household.id} procedureId={procedureId} />
        </Suspense>
      </div>
    </>
  );
}
