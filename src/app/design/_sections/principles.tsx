import { ExternalLink } from "lucide-react";
import { ListCard, ListRow } from "~/components/ds/list";
import { DocSection, Specimen } from "../_components/doc";
import {
  EVIDENCE_LABEL,
  PRINCIPLE_GROUPS,
  REFERENCE_APPS,
  SOURCES,
  type Principle,
} from "./principles-data";

function PrincipleCard({ principle }: { principle: Principle }) {
  const { title, rule, why, evidence, appliedIn } = principle;
  return (
    <li className="space-y-1.5 rounded-xl bg-card p-4 shadow-soft ring-1 ring-border/40 dark:ring-border">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <span className="text-xs text-muted-foreground">
          {EVIDENCE_LABEL[evidence]}
        </span>
      </div>
      <p className="text-pretty text-sm text-foreground">{rule}</p>
      <p className="text-pretty text-sm text-muted-foreground">{why}</p>
      {appliedIn && (
        <p className="text-xs text-muted-foreground">
          In the code: <code className="font-mono">{appliedIn}</code>
        </p>
      )}
    </li>
  );
}

/**
 * How screens should behave, and why: read this before improving a page.
 * The content lives in `principles-data.ts`.
 */
export function PrinciplesSection() {
  return (
    <DocSection
      id="principles"
      title="Principles"
      description="How screens should behave, and the evidence behind each rule. Read this before improving a page, and add to it when a study or a real bug teaches something new."
    >
      {PRINCIPLE_GROUPS.map((group) => (
        <Specimen key={group.title} title={group.title}>
          <ul className="grid gap-3 md:grid-cols-2">
            {group.principles.map((p) => (
              <PrincipleCard key={p.title} principle={p} />
            ))}
          </ul>
        </Specimen>
      ))}

      <Specimen
        title="Apps worth comparing"
        usage="From Lazyweb's descriptions of real screens. Look at a few of these before designing a new one."
      >
        <ListCard>
          {REFERENCE_APPS.map((ref) => (
            <ListRow key={ref.app} title={ref.app} subtitle={ref.takeaway} />
          ))}
        </ListCard>
      </Specimen>

      <Specimen title="Sources">
        <ul className="space-y-2">
          {SOURCES.map((source) => (
            <li key={source.href} className="text-sm">
              <a
                href={source.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
              >
                {source.label}
                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </a>
              {source.note && (
                <span className="block text-xs text-muted-foreground">
                  {source.note}
                </span>
              )}
            </li>
          ))}
        </ul>
      </Specimen>
    </DocSection>
  );
}
