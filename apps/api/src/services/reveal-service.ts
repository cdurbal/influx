import { randomUUID } from "node:crypto";
import {
  type Account,
  type Introduction,
  IntroductionSchema,
} from "@influx/contracts";
import { MockStore, type OutboxEventRecord } from "../mocks/mock-store";

export interface ConversationParticipant {
  accountId: string;
  role: "advertiser" | "creator" | "agent";
  displayName: string;
  email: string;
  joinedAt: string;
}

export interface Conversation {
  id: string;
  introductionId: string;
  campaignId: string | null;
  participants: ConversationParticipant[];
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderAccountId: string;
  senderRole: "advertiser" | "creator" | "agent" | "system";
  content: string;
  createdAt: string;
}

export interface Deal {
  id: string;
  introductionId: string;
  campaignId: string | null;
  advertiserAccountId: string;
  creatorAccountId: string;
  ownerAgentId: string;
  status:
    | "open"
    | "negotiating"
    | "contract_sent"
    | "signed"
    | "paid"
    | "lost"
    | "cancelled";
  currency: string;
  negotiatedAmountMinor: number | null; // Saisie commerciale manuelle ultérieure (A1 & A8)
  agreedCommissionMinor: number | null; // Saisie commerciale manuelle ultérieure
  contractSendingMode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmittedEmail {
  recipientEmail: string;
  messageId: string;
  role: "advertiser" | "creator";
  reference: string;
  sentAt: string;
}

export interface RevealResult {
  introduction: Introduction;
  conversation: Conversation;
  deal: Deal;
  emailsEmitted: EmittedEmail[];
}

export class RevealService {
  private store: MockStore;

  constructor(store?: MockStore) {
    this.store = store ?? MockStore.getInstance();
  }

  /**
   * TRANSACTION ATOMIQUE DE RÉVÉLATION D'IDENTITÉ (Mission 4.3 / RG-M2 / D37 / 01 §3 étape 5)
   * 1. Fige identity_revealed_at = now() (contrainte WRITE-ONCE absolue)
   * 2. Crée la conversation à trois participants (Marque, Créateur, Commercial nommé)
   * 3. Crée le deal commercial initial (état 'open')
   * 4. Enregistre l'événement chaîné dans le journal d'audit
   * 5. Émet les 2 e-mails transactionnels aux deux parties avec conservation du messageId
   */
  public async revealIdentity(introductionId: string): Promise<RevealResult> {
    const raw = this.store.introductions.get(introductionId);
    if (!raw) {
      throw {
        status: 404,
        code: "NOT_FOUND",
        message: "Mise en relation introuvable",
      };
    }

    const intro = { ...(raw as unknown as Introduction) };

    // Contrainte WRITE-ONCE : une identité révélée ne peut être réécrite ni répétée
    if (intro.identityRevealedAt) {
      throw {
        status: 409,
        code: "ALREADY_REVEALED",
        message: `L'identité a déjà été révélée pour cette mise en relation le ${intro.identityRevealedAt}`,
      };
    }

    // Doit être validée par un commercial
    if (intro.status !== "approved") {
      throw {
        status: 400,
        code: "NOT_APPROVED",
        message:
          "La mise en relation doit être approuvée par un commercial avant révélation",
      };
    }

    // Le consentement des deux parties est obligatoire (01 §4.3)
    if (!intro.advertiserAcceptedAt || !intro.creatorAcceptedAt) {
      throw {
        status: 400,
        code: "CONSENT_MISSING",
        message:
          "Les deux parties doivent avoir accepté l'invitation à l'écran avant toute révélation d'identité",
      };
    }

    const advertiserAccount = this.store.accounts.get(
      intro.advertiserAccountId,
    );
    const creatorAccount = this.store.accounts.get(intro.creatorAccountId);

    if (!advertiserAccount || !creatorAccount) {
      throw {
        status: 404,
        code: "PARTIES_NOT_FOUND",
        message: "L'une des parties prenantes est introuvable",
      };
    }

    // Commercial titulaire
    const ownerAgentId =
      intro.ownerAgentId ||
      advertiserAccount.ownerAgentId ||
      "88888888-8888-4888-8888-888888888888";
    const agentAccount = this.store.accounts.get(ownerAgentId);
    const agentEmail = agentAccount?.email || "alexandre@influx.io";
    const agentName = "Alexandre - Commercial INFLUX";

    // Récupération des profils pour les noms réels révélés
    const brandProfile = this.store.brandProfiles.get(advertiserAccount.id) as
      { companyName?: string } | undefined;
    const creatorProfile = this.store.creatorProfiles.get(creatorAccount.id) as
      { legalName?: string; publicHandle?: string } | undefined;

    const advertiserDisplayName =
      brandProfile?.companyName ||
      advertiserAccount.email.split("@")[0] ||
      "Annonceur";
    const creatorDisplayName =
      creatorProfile?.legalName ||
      creatorProfile?.publicHandle ||
      creatorAccount.email.split("@")[0] ||
      "Créateur";

    const now = new Date().toISOString();

    // 1. Figeage WRITE-ONCE de la date de révélation
    intro.identityRevealedAt = now;
    intro.updatedAt = now;

    // 2. Création de la conversation à trois
    const conversationId = randomUUID();
    const conversation: Conversation = {
      id: conversationId,
      introductionId: intro.id,
      campaignId: intro.campaignId ?? null,
      participants: [
        {
          accountId: advertiserAccount.id,
          role: "advertiser",
          displayName: advertiserDisplayName,
          email: advertiserAccount.email,
          joinedAt: now,
        },
        {
          accountId: creatorAccount.id,
          role: "creator",
          displayName: creatorDisplayName,
          email: creatorAccount.email,
          joinedAt: now,
        },
        {
          accountId: ownerAgentId,
          role: "agent",
          displayName: agentName,
          email: agentEmail,
          joinedAt: now,
        },
      ],
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    // Premier message d'accueil et d'ouverture de session
    const welcomeMessage: ConversationMessage = {
      id: randomUUID(),
      conversationId: conversation.id,
      senderAccountId: ownerAgentId,
      senderRole: "agent",
      content: `Bonjour ${advertiserDisplayName} et ${creatorDisplayName}, vos identités respectives sont désormais révélées sous la référence ${intro.reference}. Je suis ${agentName}, votre interlocuteur dédié pour cadrer et sécuriser cette négociation.`,
      createdAt: now,
    };

    this.store.conversations.set(
      conversation.id,
      conversation as unknown as Record<string, unknown>,
    );
    this.store.messages.set(conversation.id, [
      welcomeMessage as unknown as Record<string, unknown>,
    ]);
    intro.conversationId = conversation.id;

    // 3. Création automatique du Deal commercial dans le pipeline
    const dealId = randomUUID();
    const deal: Deal = {
      id: dealId,
      introductionId: intro.id,
      campaignId: intro.campaignId ?? null,
      advertiserAccountId: advertiserAccount.id,
      creatorAccountId: creatorAccount.id,
      ownerAgentId,
      status: "open",
      currency: "EUR",
      negotiatedAmountMinor: null, // Saisie commerciale manuelle ultérieure
      agreedCommissionMinor: null, // Saisie commerciale manuelle ultérieure
      contractSendingMode: null,
      createdAt: now,
      updatedAt: now,
    };

    this.store.deals.set(deal.id, deal as unknown as Record<string, unknown>);
    intro.dealId = deal.id;

    // 4. Enregistrement de l'introduction mise à jour
    const validatedIntro = IntroductionSchema.parse(intro);
    this.store.introductions.set(
      validatedIntro.id,
      validatedIntro as unknown as Record<string, unknown>,
    );

    // 5. Journalisation de l'événement chaîné dans le registre d'audit
    this.store.recordAuditEvent(
      "identity_revealed",
      {
        introductionId: validatedIntro.id,
        reference: validatedIntro.reference,
        conversationId: conversation.id,
        dealId: deal.id,
        advertiserAccountId: advertiserAccount.id,
        creatorAccountId: creatorAccount.id,
        ownerAgentId,
        identityRevealedAt: now,
      },
      ownerAgentId,
    );

    // 6. Émission des deux e-mails transactionnels (preuve externe / outbox)
    const advMessageId = `msg_mer_${validatedIntro.reference}_adv_${Date.now()}`;
    const creatorMessageId = `msg_mer_${validatedIntro.reference}_creator_${Date.now()}`;

    const advEmailEvent: OutboxEventRecord = {
      id: randomUUID(),
      eventType: "email.identity_revealed",
      payload: {
        recipientEmail: advertiserAccount.email,
        recipientRole: "advertiser",
        reference: validatedIntro.reference,
        revealedOtherPartyName: creatorDisplayName,
        agentName,
        conversationId: conversation.id,
        campaignId: validatedIntro.campaignId,
        messageId: advMessageId,
        sentAt: now,
      },
      status: "synced",
      attempts: 1,
      createdAt: now,
    };

    const creatorEmailEvent: OutboxEventRecord = {
      id: randomUUID(),
      eventType: "email.identity_revealed",
      payload: {
        recipientEmail: creatorAccount.email,
        recipientRole: "creator",
        reference: validatedIntro.reference,
        revealedOtherPartyName: advertiserDisplayName,
        agentName,
        conversationId: conversation.id,
        campaignId: validatedIntro.campaignId,
        messageId: creatorMessageId,
        sentAt: now,
      },
      status: "synced",
      attempts: 1,
      createdAt: now,
    };

    this.store.outboxEvents.push(advEmailEvent, creatorEmailEvent);

    const emailsEmitted: EmittedEmail[] = [
      {
        recipientEmail: advertiserAccount.email,
        messageId: advMessageId,
        role: "advertiser",
        reference: validatedIntro.reference,
        sentAt: now,
      },
      {
        recipientEmail: creatorAccount.email,
        messageId: creatorMessageId,
        role: "creator",
        reference: validatedIntro.reference,
        sentAt: now,
      },
    ];

    return {
      introduction: validatedIntro,
      conversation,
      deal,
      emailsEmitted,
    };
  }

  /**
   * ACCEPTATION FORMELLE D'UNE INVITATION PAR UN MEMBRE (Marque ou Créateur)
   * Si les deux parties ont désormais accepté ET que la demande est approuvée,
   * la révélation d'identité atomique est immédiatement déclenchée.
   */
  public async acceptIntroduction(
    introductionId: string,
    account: Account,
  ): Promise<{
    introduction: Introduction;
    revealed: boolean;
    revealResult?: RevealResult;
  }> {
    const raw = this.store.introductions.get(introductionId);
    if (!raw) {
      throw {
        status: 404,
        code: "NOT_FOUND",
        message: "Mise en relation introuvable",
      };
    }

    const intro = { ...(raw as unknown as Introduction) };

    if (
      intro.status === "rejected" ||
      intro.status === "withdrawn" ||
      intro.status === "expired"
    ) {
      throw {
        status: 400,
        code: "CANNOT_ACCEPT",
        message: "Cette mise en relation n'est plus active",
      };
    }

    const now = new Date().toISOString();
    let hasUpdated = false;

    if (
      account.role === "advertiser" &&
      intro.advertiserAccountId === account.id
    ) {
      if (!intro.advertiserAcceptedAt) {
        intro.advertiserAcceptedAt = now;
        intro.advertiserTermsVersionId = "cgu-v1";
        hasUpdated = true;
      }
    } else if (
      account.role === "creator" &&
      intro.creatorAccountId === account.id
    ) {
      if (!intro.creatorAcceptedAt) {
        intro.creatorAcceptedAt = now;
        intro.creatorTermsVersionId = "cgu-v1";
        hasUpdated = true;
      }
    } else {
      throw {
        status: 403,
        code: "FORBIDDEN",
        message: "Vous n'êtes pas partie prenante de cette mise en relation",
      };
    }

    if (hasUpdated) {
      intro.updatedAt = now;
      const validated = IntroductionSchema.parse(intro);
      this.store.introductions.set(
        validated.id,
        validated as unknown as Record<string, unknown>,
      );

      this.store.recordAuditEvent(
        "introduction.accepted",
        {
          introductionId: validated.id,
          reference: validated.reference,
          role: account.role,
          accountId: account.id,
        },
        account.id,
      );
    }

    // Vérification du déclenchement de la révélation d'identité
    const canReveal =
      intro.status === "approved" &&
      Boolean(intro.advertiserAcceptedAt) &&
      Boolean(intro.creatorAcceptedAt) &&
      !intro.identityRevealedAt;

    if (canReveal) {
      const revealResult = await this.revealIdentity(intro.id);
      return {
        introduction: revealResult.introduction,
        revealed: true,
        revealResult,
      };
    }

    return {
      introduction: IntroductionSchema.parse(
        this.store.introductions.get(intro.id),
      ),
      revealed: false,
    };
  }

  /**
   * REFUS / RETRAIT DE L'INVITATION PAR UN MEMBRE (Declined by party)
   */
  public async declineIntroduction(
    introductionId: string,
    account: Account,
  ): Promise<Introduction> {
    const raw = this.store.introductions.get(introductionId);
    if (!raw) {
      throw {
        status: 404,
        code: "NOT_FOUND",
        message: "Mise en relation introuvable",
      };
    }

    const intro = { ...(raw as unknown as Introduction) };

    const isParty =
      intro.advertiserAccountId === account.id ||
      intro.creatorAccountId === account.id;

    if (!isParty && account.role !== "agent" && account.role !== "admin") {
      throw {
        status: 403,
        code: "FORBIDDEN",
        message: "Accès refusé",
      };
    }

    if (intro.identityRevealedAt) {
      throw {
        status: 400,
        code: "ALREADY_REVEALED",
        message:
          "Une mise en relation dont l'identité est révélée ne peut pas être déclinée",
      };
    }

    const now = new Date().toISOString();
    intro.status = "rejected";
    intro.rejectionReasonCode = "other";
    intro.rejectionReasonComment = `Décliné par la partie ${account.role} (${account.email})`;
    intro.updatedAt = now;

    const validated = IntroductionSchema.parse(intro);
    this.store.introductions.set(
      validated.id,
      validated as unknown as Record<string, unknown>,
    );

    this.store.recordAuditEvent(
      "introduction.declined_by_party",
      {
        introductionId: validated.id,
        accountId: account.id,
        role: account.role,
      },
      account.id,
    );

    return validated;
  }
}
