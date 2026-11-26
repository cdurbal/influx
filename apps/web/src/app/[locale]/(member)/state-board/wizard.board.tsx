"use client";

import { useState } from "react";
import { NumberedSteps } from "@/components/member/ui/NumberedSteps";
import { Notice } from "@/components/member/ui/Notice";
import { OtpField } from "@/components/member/ui/OtpField";
import { Recap } from "@/components/member/ui/Recap";
import { TextField } from "@/components/member/ui/TextField";
import { Wizard } from "@/components/member/ui/Wizard";
import type { SaveState } from "@/components/member/ui/save-status-classes";
import type { WizardStepState } from "@/components/member/ui/wizard-classes";
import { BoardSection, BoardState } from "./board-section.board";

// The cells that hold a wizard are named « page-header-… »: a wizard writes the `h1` of its page, and the guard of the
// board counts one `h1` in each of them and exactly one outside (RUB-A §4).
const TEXTS = {
  wizardTitle: "Assistant",
  wizardNote:
    "C41 : une boîte de 768 px (une carte dès 768 px, aucune sur téléphone), la tête (titre, compte, segments de 6 px dont " +
    "la zone de toucher atteint 26 px, méta), l'étape et le pied. Chaque segment est un lien d'étape, suivi quel que soit " +
    "son état ; le courant porte aria-current. « Continuer » ne bloque jamais : il demande, l'écran décide. À un " +
    "changement d'étape, le focus va au titre de l'étape, qui n'a pas d'anneau. Sous 768 px le pied est fixé au-dessus de " +
    "la barre du bas et le statut d'enregistrement passe dans la méta ; sous 480 px « Précédent » n'est plus que son " +
    "chevron, son nom gardé pour le lecteur d'écran.",
  wizardStates: {
    start: "Étape en cours, navigation libre",
    gap: "Première étape, étape à compléter, avis de l'écran",
    busy: "Envoi en cours, enregistrement en échec",
  },
  wizardTitleText: "Création de votre profil",
  stepsLabel: "Étapes",
  remaining: "Environ 12 min au total",
  leave: "Enregistrer et reprendre plus tard",
  previous: "Précédent",
  continueTo: (step: string) => `Continuer : ${step}`,
  continueBusy: "Envoi en cours",
  progress: (step: number, count: number) => `Étape ${step} sur ${count}`,
  stepNames: [
    "Vous présenter",
    "Votre ligne éditoriale",
    "Vos réseaux",
    "Votre audience",
    "Votre offre",
  ],
  stepIntro: "Ce que les marques lisent en premier. Environ 3 min.",
  stepStateWords: {
    todo: "à faire",
    current: "en cours",
    done: "faite",
    gap: "à compléter",
  },
  stepLabel: (step: number, count: number, name: string, state: string) =>
    `Étape ${step} sur ${count} : ${name}, ${state}`,
  headlineLabel: "Titre court",
  headlineHelp: "Votre activité en une ligne.",
  headline: "Cuisine végétale de saison, recettes simples",
  conflictTitle: "Une autre version existe.",
  conflictText:
    "Ce profil a été modifié depuis un autre appareil. Rechargez-le pour continuer.",
  saveIdle: "Enregistré automatiquement",
  saveSaving: "Enregistrement…",
  saveSaved: (time: string) => `Enregistré à ${time}`,
  saveFailed: "Non enregistré : vos modifications sont gardées ici",
  saveRetryIn: (seconds: number) => `Nouvel essai dans ${seconds} s`,
  saveRetry: "Réessayer",
  saveTime: "14:07",
  recapTitle: "Récapitulatif",
  recapNote:
    "C42 : une section par étape sous un filet, son titre de niveau 3 et « Modifier » sur une ligne (le nom de la " +
    "section est lu après le lien), les réponses sur une étiquette de 11 rem, ce qui manque en ligne d'alerte avec son " +
    "icône. Rien n'est envoyé ni bloqué ici.",
  recapStates: {
    complete: "Complet",
    missing: "Avec des manques",
  },
  recapEdit: "Modifier",
  recapEmpty: "Non renseigné",
  recapSections: {
    presentation: "1. Vous présenter",
    editorial: "2. Votre ligne éditoriale",
    networks: "3. Vos réseaux et vos chiffres",
  },
  recapItems: {
    headline: "Titre court",
    bio: "Bio",
    themes: "Thématiques",
    network: "Réseau",
    figures: "Chiffres",
  },
  recapValues: {
    headline: "Cuisine végétale de saison",
    bio: "Recettes de saison, testées en famille.",
    themes: "Cuisine, famille",
    network: "Instagram",
  },
  recapMissing: "À compléter : les chiffres de l'audience",
  recapMissingBio: "À compléter : la bio, de 150 à 800 caractères",
  otpTitle: "Champ du code",
  otpNote:
    "C49 : six cases de 5 sur 6 dans 22 rem, mais un seul champ, invisible, par-dessus : le code proposé par le " +
    "système ou collé le remplit d'un coup (les espaces et les tirets sont ôtés), un lecteur d'écran entend un champ. " +
    "La case qui attend le chiffre suivant a son contour de focus ; l'erreur trace les six en rouge, sans bouger " +
    "les cases. La variante en ligne est le champ du code sans cases (compte, backoffice).",
  otpStates: {
    empty: "Vide, à saisir",
    partial: "Partiel",
    complete: "Complet",
    error: "Erreur",
    blocked: "Bloqué : plus d'essais",
    busy: "Vérification en cours",
    line: "Variante en ligne",
  },
  otpLabel: "Code à 6 chiffres",
  otpRequired: "obligatoire",
  otpHelp: "Restez dans cet onglet : le code ne fonctionne qu'ici.",
  otpError: "Ce code est incorrect. Il vous reste 4 essais.",
  otpBlocked: "Trop d'essais. Demandez un nouveau code.",
  otpLine: "Code reçu à l'adresse actuelle",
  stepsTitle: "Étapes numérotées",
  stepsNote:
    "C51 : les étapes d'un court parcours vues d'un coup, jamais un formulaire. Une étape faite montre une coche, " +
    "l'étape en cours est en graisse 600 sur un repère allumé avec un contour que les couleurs forcées dessinent, une " +
    "étape à faire montre son numéro ; l'état est écrit avant le nom pour le lecteur d'écran.",
  stepsStates: {
    process: "Changement d'adresse : une faite, une en cours, une à faire",
    body: "Avec un texte sous le nom",
  },
  stepsLabelText: "Étapes du changement d'adresse",
  stepsStateLabels: {
    todo: "À faire : ",
    current: "En cours : ",
    done: "Faite : ",
  },
  stepsItems: {
    address: "Saisir la nouvelle adresse",
    confirm: "Confirmer que c'est bien vous",
    codes: "Saisir les deux codes reçus",
  },
  stepsBody: "Un code part ensuite à chacune des deux adresses.",
} as const;

const STEP_COUNT = TEXTS.stepNames.length;

function stepsOf(
  current: number,
  gapAt?: number,
): { id: string; label: string; state: WizardStepState; href: string }[] {
  return TEXTS.stepNames.map((name, index) => {
    const number = index + 1;
    const state: WizardStepState =
      number === current
        ? "current"
        : number < current
          ? "done"
          : number === gapAt
            ? "gap"
            : "todo";
    return {
      id: `step-${number}`,
      href: `#step-${number}`,
      label: TEXTS.stepLabel(
        number,
        STEP_COUNT,
        name,
        TEXTS.stepStateWords[state],
      ),
      state,
    };
  });
}

function saveTexts(state: SaveState) {
  return {
    state,
    savedAt: TEXTS.saveTime,
    retryInSeconds: 5,
    onRetry: () => undefined,
    idleText: TEXTS.saveIdle,
    savingText: TEXTS.saveSaving,
    savedText: TEXTS.saveSaved,
    failedText: TEXTS.saveFailed,
    retryInText: TEXTS.saveRetryIn,
    retryLabel: TEXTS.saveRetry,
  };
}

/** The wizard as a screen drives it: « Continue » and « Previous » change the step, the fields are the screen's. */
function WizardDemo() {
  const [step, setStep] = useState(2);
  const [headline, setHeadline] = useState<string>(TEXTS.headline);
  const name = TEXTS.stepNames[step - 1] ?? "";
  const following = TEXTS.stepNames[step] ?? name;
  return (
    <Wizard
      title={TEXTS.wizardTitleText}
      progress={TEXTS.progress(step, STEP_COUNT)}
      stepsLabel={TEXTS.stepsLabel}
      steps={stepsOf(step, 4)}
      remaining={TEXTS.remaining}
      leave={{ href: "#later", label: TEXTS.leave }}
      save={saveTexts("saved")}
      name={name}
      intro={TEXTS.stepIntro}
      back={
        step > 1
          ? {
              label: TEXTS.previous,
              onClick: () => setStep((value) => Math.max(1, value - 1)),
            }
          : undefined
      }
      next={{
        label: TEXTS.continueTo(following),
        onClick: () => setStep((value) => Math.min(STEP_COUNT, value + 1)),
      }}
    >
      <TextField
        id="board-wizard-headline"
        name="headline"
        label={TEXTS.headlineLabel}
        help={TEXTS.headlineHelp}
        value={headline}
        onChange={setHeadline}
        maxLength={120}
      />
    </Wizard>
  );
}

function WizardStates() {
  return (
    <BoardSection
      component="wizard"
      title={TEXTS.wizardTitle}
      note={TEXTS.wizardNote}
    >
      <BoardState
        state="page-header-wizard-start"
        label={TEXTS.wizardStates.start}
        bare
        className="contain-layout max-md:pb-12"
      >
        <WizardDemo />
      </BoardState>
      <BoardState
        state="page-header-wizard-gap"
        label={TEXTS.wizardStates.gap}
        bare
        className="contain-layout max-md:pb-12"
      >
        <Wizard
          title={TEXTS.wizardTitleText}
          progress={TEXTS.progress(1, STEP_COUNT)}
          stepsLabel={TEXTS.stepsLabel}
          steps={stepsOf(1, 3)}
          leave={{ href: "#later", label: TEXTS.leave }}
          save={saveTexts("idle")}
          name={TEXTS.stepNames[0] ?? ""}
          intro={TEXTS.stepIntro}
          notice={
            <Notice tone="warning" title={TEXTS.conflictTitle}>
              {TEXTS.conflictText}
            </Notice>
          }
          next={{
            label: TEXTS.continueTo(TEXTS.stepNames[1] ?? ""),
            onClick: () => undefined,
          }}
        />
      </BoardState>
      <BoardState
        state="page-header-wizard-busy"
        label={TEXTS.wizardStates.busy}
        bare
        className="contain-layout max-md:pb-12"
      >
        <Wizard
          title={TEXTS.wizardTitleText}
          progress={TEXTS.progress(5, STEP_COUNT)}
          stepsLabel={TEXTS.stepsLabel}
          steps={stepsOf(5)}
          remaining={TEXTS.remaining}
          leave={{ href: "#later", label: TEXTS.leave }}
          save={saveTexts("failed")}
          name={TEXTS.stepNames[4] ?? ""}
          back={{ label: TEXTS.previous, href: "#step-4" }}
          next={{
            label: TEXTS.continueBusy,
            onClick: () => undefined,
            busy: true,
          }}
        />
      </BoardState>
    </BoardSection>
  );
}

function RecapStates() {
  return (
    <BoardSection
      component="recap"
      title={TEXTS.recapTitle}
      note={TEXTS.recapNote}
    >
      <BoardState state="complete" label={TEXTS.recapStates.complete}>
        <Recap
          className="w-full"
          editLabel={TEXTS.recapEdit}
          emptyLabel={TEXTS.recapEmpty}
          sections={[
            {
              id: "complete-presentation",
              title: TEXTS.recapSections.presentation,
              editHref: "#step-1",
              items: [
                {
                  label: TEXTS.recapItems.headline,
                  value: TEXTS.recapValues.headline,
                },
                { label: TEXTS.recapItems.bio, value: TEXTS.recapValues.bio },
              ],
            },
            {
              id: "complete-editorial",
              title: TEXTS.recapSections.editorial,
              editHref: "#step-2",
              items: [
                {
                  label: TEXTS.recapItems.themes,
                  value: TEXTS.recapValues.themes,
                },
              ],
            },
          ]}
        />
      </BoardState>
      <BoardState state="missing" label={TEXTS.recapStates.missing}>
        <Recap
          className="w-full"
          editLabel={TEXTS.recapEdit}
          emptyLabel={TEXTS.recapEmpty}
          sections={[
            {
              id: "missing-presentation",
              title: TEXTS.recapSections.presentation,
              editHref: "#step-1",
              items: [
                {
                  label: TEXTS.recapItems.headline,
                  value: TEXTS.recapValues.headline,
                },
                { label: TEXTS.recapItems.bio, value: "", empty: true },
              ],
              missing: [TEXTS.recapMissingBio],
            },
            {
              id: "missing-networks",
              title: TEXTS.recapSections.networks,
              editHref: "#step-3",
              items: [
                {
                  label: TEXTS.recapItems.network,
                  value: TEXTS.recapValues.network,
                },
                { label: TEXTS.recapItems.figures, value: "", empty: true },
              ],
              missing: [TEXTS.recapMissing],
            },
          ]}
        />
      </BoardState>
    </BoardSection>
  );
}

function TypedCode({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <OtpField
      label={TEXTS.otpLabel}
      requiredLabel={TEXTS.otpRequired}
      help={TEXTS.otpHelp}
      value={value}
      onChange={setValue}
      className="w-full"
    />
  );
}

function OtpStates() {
  return (
    <BoardSection
      component="otp-field"
      title={TEXTS.otpTitle}
      note={TEXTS.otpNote}
    >
      <BoardState state="empty" label={TEXTS.otpStates.empty}>
        <TypedCode />
      </BoardState>
      <BoardState state="partial" label={TEXTS.otpStates.partial}>
        <TypedCode initial="123" />
      </BoardState>
      <BoardState state="complete" label={TEXTS.otpStates.complete}>
        <OtpField
          label={TEXTS.otpLabel}
          value="123456"
          onChange={() => undefined}
          className="w-full"
        />
      </BoardState>
      <BoardState state="error" label={TEXTS.otpStates.error}>
        <OtpField
          label={TEXTS.otpLabel}
          value="123456"
          onChange={() => undefined}
          error={TEXTS.otpError}
          className="w-full"
        />
      </BoardState>
      <BoardState state="blocked" label={TEXTS.otpStates.blocked}>
        <OtpField
          label={TEXTS.otpLabel}
          value="1234"
          onChange={() => undefined}
          disabled
          help={TEXTS.otpBlocked}
          className="w-full"
        />
      </BoardState>
      <BoardState state="busy" label={TEXTS.otpStates.busy}>
        <OtpField
          label={TEXTS.otpLabel}
          value="123456"
          onChange={() => undefined}
          busy
          className="w-full"
        />
      </BoardState>
      <BoardState state="line" label={TEXTS.otpStates.line}>
        <OtpField
          variant="line"
          label={TEXTS.otpLine}
          value="123"
          onChange={() => undefined}
          className="w-full"
        />
      </BoardState>
    </BoardSection>
  );
}

function StepsStates() {
  return (
    <BoardSection
      component="numbered-steps"
      title={TEXTS.stepsTitle}
      note={TEXTS.stepsNote}
    >
      <BoardState state="process" label={TEXTS.stepsStates.process}>
        <NumberedSteps
          label={TEXTS.stepsLabelText}
          stateLabels={TEXTS.stepsStateLabels}
          items={[
            { label: TEXTS.stepsItems.address, state: "done" },
            { label: TEXTS.stepsItems.confirm, state: "current" },
            { label: TEXTS.stepsItems.codes, state: "todo" },
          ]}
        />
      </BoardState>
      <BoardState state="body" label={TEXTS.stepsStates.body}>
        <NumberedSteps
          label={TEXTS.stepsLabelText}
          stateLabels={TEXTS.stepsStateLabels}
          items={[
            { label: TEXTS.stepsItems.address, state: "done" },
            { label: TEXTS.stepsItems.confirm, state: "done" },
            {
              label: TEXTS.stepsItems.codes,
              state: "current",
              body: TEXTS.stepsBody,
            },
          ]}
        />
      </BoardState>
    </BoardSection>
  );
}

export function WizardBoard() {
  return (
    <>
      <WizardStates />
      <RecapStates />
      <OtpStates />
      <StepsStates />
    </>
  );
}
