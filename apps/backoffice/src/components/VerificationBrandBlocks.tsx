"use client";

// The three blocks of the decision screen of a brand's verification request that are not the creator's
// (docs/mvp/06 RG46 to RG52, RG61, CA28, CA29; 17b §3.7; jalons/l2e/modele.md §4, §5; L2E-23): "La demande"
// (the trading name, the declared domain, the internal block: legal name, country and number of the
// registration), "Ce qu'il faut constater" (the procedure and the register to open, in a new window) and
// "Ce que je constate" (what the agent TYPES: the domain where the code was read, how it is published, the
// code, and the register he consulted, chosen among the sources the dossier served, never typed: RG52, D79
// (12)). No piece, no handle, no figure, no capture asked of the brand (RG61): none of the creator's blocks
// is reused but the typed field and the history. No rule here: the database compares the code, the domain
// and the source.
import {
  BRAND_OBSERVED_CHANNELS,
  type VerificationOpenResponse,
} from "@influx/contracts/verification";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import {
  BLOCK_TITLE,
  DD_CLASSES,
  DL_CLASSES,
  DT_CLASSES,
  LINK_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
} from "./bo-classes";
import { ErrorNotice } from "./ErrorNotice";
import { DossierHistory } from "./VerificationDossierBlocks";
import { loginProofOffered } from "./verification-opening-view";
import { FIELD_ID, TypedField } from "./VerificationRecordBlock";
import {
  levelName,
  reexamineMarkLine,
  registryLinkOf,
  registrySourceWords,
  type Draft,
  type DomainProof,
  type Problem,
} from "./verification-decision-view";
import { countryName, formatDateTime } from "./view-model";

const t = messages.verificationReview;
const b = t.brand;

/** Where an agent reads the whole table of the sources (read only), opened apart so that the typing stays. */
export const REGISTRY_SOURCES_ADDRESS = "/reglages/sources-registre";

export function BrandRequestBlock({
  view,
}: {
  view: VerificationOpenResponse;
}) {
  const { dossier, entry, account } = view;
  const brand = dossier?.brand ?? null;
  const details = brand?.internalDetails ?? null;
  const language = (messages.languages as Readonly<Record<string, string>>)[
    account.preferredLanguage
  ];
  const reexamine = reexamineMarkLine(view);
  const facts: { key: string; label: string; value: ReactNode }[] = [
    {
      key: "brand",
      label: b.facts.brand,
      value: brand?.tradeName ?? t.unset,
    },
    {
      key: "country",
      label: t.facts.country,
      value: countryName(account.countryCode),
    },
    {
      key: "language",
      label: t.facts.language,
      value: language ?? account.preferredLanguage,
    },
    {
      key: "owner",
      label: t.facts.owner,
      value: account.owner?.displayName ?? t.noOwner,
    },
    { key: "level", label: t.facts.level, value: levelName(entry.level) },
    ...(dossier === null
      ? []
      : [
          {
            key: "domain",
            label: b.facts.domain,
            value: (
              <>
                <span className="font-mono break-all">
                  {brand?.websiteDomain ?? t.unset}
                </span>
                <span className="block text-text-secondary">
                  {b.facts.domainHelp}
                </span>
              </>
            ),
          },
          {
            key: "legalName",
            label: b.facts.legalName,
            value: details?.legalName ?? b.facts.unset,
          },
          {
            key: "registrationCountry",
            label: b.facts.registrationCountry,
            value:
              details === null
                ? b.facts.unset
                : countryName(details.registrationCountryCode),
          },
          {
            key: "registrationNumber",
            label: b.facts.registrationNumber,
            value: (
              <>
                <span className="font-mono break-all">
                  {details?.registrationNumber ?? b.facts.unset}
                </span>
                <span className="block text-text-secondary">
                  {details === null
                    ? b.facts.detailsMissing
                    : b.facts.detailsHelp}
                </span>
              </>
            ),
          },
        ]),
    {
      key: "submitted",
      label: t.facts.submitted,
      value: (
        <span className="tabular-nums">
          {formatDateTime(entry.submittedAt)}
        </span>
      ),
    },
    ...(dossier?.codeExpiresAt == null
      ? []
      : [
          {
            key: "codeExpiry",
            label: t.facts.codeExpiry,
            value: (
              <span className="tabular-nums">
                {formatDateTime(dossier.codeExpiresAt)}
              </span>
            ),
          },
        ]),
  ];
  return (
    <section aria-labelledby="verification-request" className={SECTION_CLASSES}>
      <h2 id="verification-request" className={SECTION_TITLE}>
        {t.sections.request}
      </h2>
      {reexamine === null ? null : (
        <p className="text-sm font-semibold text-text-primary">{reexamine}</p>
      )}
      <dl className={DL_CLASSES}>
        {facts.map((fact) => (
          <div key={fact.key} className="contents">
            <dt className={DT_CLASSES}>{fact.label}</dt>
            <dd className={DD_CLASSES}>{fact.value}</dd>
          </div>
        ))}
      </dl>
      {dossier === null ? null : (
        <DossierHistory dossier={dossier} view={view} />
      )}
    </section>
  );
}

/** The steps, what is never done, and the register to open: its page opens in a new window, with no referrer. */
export function BrandProcedureBlock({
  view,
}: {
  view: VerificationOpenResponse;
}) {
  const sources = view.dossier?.brand?.registrySources ?? [];
  return (
    <section
      aria-labelledby="verification-procedure"
      className={SECTION_CLASSES}
    >
      <h2 id="verification-procedure" className={SECTION_TITLE}>
        {t.sections.procedure}
      </h2>
      <p className="text-sm text-text-primary">{b.procedure.admissibility}</p>
      <ol className="list-decimal pl-5 text-sm text-text-primary">
        {b.procedure.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className={HELP_CLASSES}>{b.procedure.never}</p>
      <div className="flex flex-col gap-2">
        <h3 className={BLOCK_TITLE}>{b.source.title}</h3>
        {sources.length === 0 ? (
          <>
            <p className="text-sm font-semibold text-text-primary">
              {b.source.none}
            </p>
            <p className="text-sm text-text-primary">{b.source.noneAction}</p>
          </>
        ) : (
          <ul className="flex flex-col gap-2 text-sm text-text-primary">
            {sources.map((source) => {
              const link = registryLinkOf(source.url);
              return (
                <li key={source.id} className="flex flex-col gap-1">
                  <span>{registrySourceWords(source)}</span>
                  {link === null ? (
                    <span className={HELP_CLASSES}>{b.source.noLink}</span>
                  ) : (
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer noopener"
                      className={LINK_CLASSES}
                    >
                      {b.source.open(source.name)}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <Link
          href={REGISTRY_SOURCES_ADDRESS}
          target="_blank"
          rel="noopener"
          className={LINK_CLASSES}
        >
          {b.procedure.sourcesLink}
        </Link>
      </div>
    </section>
  );
}

/** What the agent types, never pre-filled: the domain, how the code is published, the code, the register consulted. */
export function BrandRecordBlock({
  view,
  draft,
  proof,
  problem,
  onDraft,
  onProof,
}: {
  view: VerificationOpenResponse;
  draft: Draft;
  proof: DomainProof | null;
  problem: Problem | null;
  onDraft: (next: Draft) => void;
  onProof: (next: DomainProof) => void;
}) {
  const sources = view.dossier?.brand?.registrySources ?? [];
  const set = (patch: Partial<Draft>) => onDraft({ ...draft, ...patch });
  const proofProblem = problem?.field === "proof" ? problem : null;
  // D83 A-bis: when the base says the login address proves the domain, the agent may skip the code
  const offered = loginProofOffered(view);
  const byLogin = offered && proof === "login";
  const channelProblem = problem?.field === "channel" ? problem : null;
  const registryProblem = problem?.field === "registry" ? problem : null;

  // A refused field takes the focus: the agent goes on from there (the typed text is still all there).
  const failing = problem?.field ?? null;
  useEffect(() => {
    if (failing !== null) {
      document.getElementById(FIELD_ID(failing))?.focus();
    }
  }, [failing, problem]);

  return (
    <section aria-labelledby="verification-record" className={SECTION_CLASSES}>
      <h2 id="verification-record" className={SECTION_TITLE}>
        {t.sections.record}
      </h2>
      <p className={HELP_CLASSES}>{b.record.lead}</p>
      {offered ? (
        <fieldset className="flex flex-col gap-2" data-proof-choice>
          <legend className="mb-1 text-sm font-semibold text-text-primary">
            {b.record.proofLegend}
          </legend>
          {(["login", "code"] as const).map((choice, at) => (
            <label
              key={choice}
              className="flex min-h-(--size-bo-control) items-center gap-2 text-sm text-text-primary"
            >
              <input
                id={at === 0 ? FIELD_ID("proof") : undefined}
                type="radio"
                name="verification-brand-proof"
                value={choice}
                checked={proof === choice}
                onChange={() => onProof(choice)}
                className="size-(--size-checkbox)"
              />
              {choice === "login" ? b.record.proofLogin : b.record.proofCode}
            </label>
          ))}
          {byLogin ? (
            <p className={HELP_CLASSES}>{b.record.proofLoginHelp}</p>
          ) : null}
          {proofProblem === null ? null : (
            <ErrorNotice>{proofProblem.text}</ErrorNotice>
          )}
        </fieldset>
      ) : null}
      {byLogin ? null : (
        <>
          <TypedField
            field="domain"
            label={b.record.domain}
            help={b.record.domainHelp}
            value={draft.domain}
            problem={problem}
            mono
            onChange={(domain) => set({ domain })}
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-text-primary">
              {b.record.channelLegend}
            </legend>
            {BRAND_OBSERVED_CHANNELS.map((channel, at) => (
              <label
                key={channel}
                className="flex min-h-(--size-bo-control) items-center gap-2 text-sm text-text-primary"
              >
                <input
                  id={at === 0 ? FIELD_ID("channel") : undefined}
                  type="radio"
                  name="verification-brand-channel"
                  value={channel}
                  checked={draft.channel === channel}
                  onChange={() => set({ channel })}
                  className="size-(--size-checkbox)"
                />
                {b.record.channels[channel]}
              </label>
            ))}
            {channelProblem === null ? null : (
              <ErrorNotice>{channelProblem.text}</ErrorNotice>
            )}
          </fieldset>
          <TypedField
            field="code"
            label={b.record.code}
            help={b.record.codeHelp}
            value={draft.code}
            problem={problem}
            mono
            onChange={(code) => set({ code })}
          />
        </>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-text-primary">
          {b.record.registryLegend}
        </legend>
        <p className={HELP_CLASSES}>{b.record.registryHelp}</p>
        {sources.length === 0 ? (
          <p className="text-sm text-text-primary">{b.source.none}</p>
        ) : (
          sources.map((source, at) => (
            <label
              key={source.id}
              className="flex min-h-(--size-bo-control) items-center gap-2 text-sm text-text-primary"
            >
              <input
                id={at === 0 ? FIELD_ID("registry") : undefined}
                type="radio"
                name="verification-brand-registry"
                value={source.id}
                checked={draft.registrySourceId === source.id}
                onChange={() => set({ registrySourceId: source.id })}
                className="size-(--size-checkbox)"
              />
              {registrySourceWords(source)}
            </label>
          ))
        )}
        {registryProblem === null ? null : (
          <ErrorNotice>{registryProblem.text}</ErrorNotice>
        )}
      </fieldset>
    </section>
  );
}
