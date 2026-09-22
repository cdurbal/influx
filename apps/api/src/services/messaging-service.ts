import { randomUUID } from "node:crypto";
import {
  type Account,
  type Conversation,
  type ConversationCloseReason,
  type ConversationMessage,
  type ConversationChannel,
  type ContactDetection,
  type ContactDetectionType,
  type DetectedSpan,
  type CheckMessageResponse,
  type SendMessageRequest,
  type AgentAccessReason,
  type ConversationAccessLog,
  type AccessConversationQuery,
  ConversationSchema,
  ConversationMessageSchema,
  ContactDetectionSchema,
  ConversationAccessLogSchema,
  ConversationChannelSchema,
} from "@influx/contracts";
import { MockStore } from "../mocks/mock-store";

export interface MessagingServiceError {
  status: number;
  code: string;
  message: string;
}

export class MessagingService {
  private store: MockStore;

  constructor(store?: MockStore) {
    this.store = store ?? MockStore.getInstance();
  }

  // ==========================================================================
  // DÉTECTION DE COORDONNÉES (Anti-contournement RG42 à RG49, 01 §M5)
  // ==========================================================================

  /**
   * Analyse textuelle pour détecter les tentatives de partage de coordonnées
   * directes (e-mail, téléphone, liens de messagerie tierce, handles, IBAN, URL).
   */
  public detectContactInfo(text: string): DetectedSpan[] {
    const detections: DetectedSpan[] = [];

    // 1. Adresses e-mail standard et obfuscées (ex: nom at domaine dot com)
    const emailStandardRegex =
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
    let match: RegExpExecArray | null;

    while ((match = emailStandardRegex.exec(text)) !== null) {
      detections.push({
        detectedType: "email",
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        label: "Adresse e-mail détectée",
      });
    }

    const emailObfuscatedRegex =
      /[a-zA-Z0-9._%+-]+\s*(?:@|\(at\)|\[at\]|\bat\b)\s*[a-zA-Z0-9.-]+\s*(?:\.|\(dot\)|\[dot\]|\bdot\b)\s*[a-zA-Z]{2,}/gi;
    while ((match = emailObfuscatedRegex.exec(text)) !== null) {
      // Éviter les doublons avec le standard
      const start = match.index;
      const end = match.index + match[0].length;
      if (
        !detections.some(
          (d) =>
            d.detectedType === "email" &&
            d.startIndex <= start &&
            d.endIndex >= end,
        )
      ) {
        detections.push({
          detectedType: "email",
          startIndex: start,
          endIndex: end,
          label: "Adresse e-mail (obfusquée) détectée",
        });
      }
    }

    // 2. Numéros de téléphone (Français et internationaux)
    // Ex: 06 12 34 56 78, +33 6 12 34 56 78, 06.12.34.56.78, 0612345678, +33612345678
    const phoneFrenchRegex =
      /(?:(?:\+|00)33[\s.-]?(?:\(0\)[\s.-]?)?|0)[1-9](?:[\s.-]?\d{2}){4}\b/g;
    while ((match = phoneFrenchRegex.exec(text)) !== null) {
      detections.push({
        detectedType: "phone",
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        label: "Numéro de téléphone français détecté",
      });
    }

    const phoneInternationalRegex =
      /(?:\+|00)[1-9]\d{0,3}[\s.-]?(?:\(?\d{1,4}\)?[\s.-]?){2,4}\d{2,4}\b/g;
    while ((match = phoneInternationalRegex.exec(text)) !== null) {
      const start = match.index;
      const end = match.index + match[0].length;
      if (!detections.some((d) => d.startIndex <= start && d.endIndex >= end)) {
        detections.push({
          detectedType: "phone",
          startIndex: start,
          endIndex: end,
          label: "Numéro de téléphone international détecté",
        });
      }
    }

    // 3. Liens de messageries instantanées tierces (WhatsApp, Telegram, Discord, Skype, Signal)
    const messagingLinkRegex =
      /(?:https?:\/\/)?(?:wa\.me|t\.me|discord\.gg|chat\.whatsapp\.com|join\.skype\.com|signal\.me)\/[a-zA-Z0-9_.-]+/gi;
    while ((match = messagingLinkRegex.exec(text)) !== null) {
      detections.push({
        detectedType: "messaging_link",
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        label: "Lien de messagerie tierce détecté",
      });
    }

    // 4. Identifiants et profils de réseaux sociaux (@handle ou URL de profil)
    const socialHandleRegex = /(?:^|\s)@[a-zA-Z0-9_.-]{3,30}\b/g;
    while ((match = socialHandleRegex.exec(text)) !== null) {
      const start = match[0].startsWith(" ") ? match.index + 1 : match.index;
      const end = match.index + match[0].length;
      detections.push({
        detectedType: "social_handle",
        startIndex: start,
        endIndex: end,
        label: "Identifiant réseau social (@) détecté",
      });
    }

    const socialUrlRegex =
      /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|tiktok\.com|twitter\.com|x\.com|youtube\.com|linkedin\.com)\/[a-zA-Z0-9_.-]+/gi;
    while ((match = socialUrlRegex.exec(text)) !== null) {
      const start = match.index;
      const end = match.index + match[0].length;
      if (!detections.some((d) => d.startIndex <= start && d.endIndex >= end)) {
        detections.push({
          detectedType: "social_handle",
          startIndex: start,
          endIndex: end,
          label: "Lien vers profil de réseau social détecté",
        });
      }
    }

    // 5. Coordonnées bancaires (IBAN)
    const ibanRegex = /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/g;
    while ((match = ibanRegex.exec(text)) !== null) {
      detections.push({
        detectedType: "iban",
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        label: "Coordonnées bancaires (IBAN) détectées",
      });
    }

    // 6. Adresses web externes génériques (non encore capturées)
    const externalUrlRegex =
      /(?:https?:\/\/|www\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/gi;
    while ((match = externalUrlRegex.exec(text)) !== null) {
      const start = match.index;
      const end = match.index + match[0].length;
      if (!detections.some((d) => d.startIndex <= start && d.endIndex >= end)) {
        detections.push({
          detectedType: "external_url",
          startIndex: start,
          endIndex: end,
          label: "Lien web externe détecté",
        });
      }
    }

    // Trier les détections par ordre chronologique d'apparition dans le texte
    return detections.sort((a, b) => a.startIndex - b.startIndex);
  }

  /**
   * Pré-contrôle non bloquant avant envoi (RG42 à RG44)
   * Le contrôle préalable ne stocke RIEN en base (zéro effet de bord).
   */
  public checkMessage(content: string): CheckMessageResponse {
    const detections = this.detectContactInfo(content);
    return {
      hasDetections: detections.length > 0,
      detections,
      warningMessage:
        detections.length > 0
          ? "Les échanges se passent ici. En dehors, INFLUX ne peut plus vous accompagner ni intervenir en cas de problème."
          : null,
    };
  }

  // ==========================================================================
  // GESTION ET ENVOI DE MESSAGES (RG35 à RG50)
  // ==========================================================================

  /**
   * Envoi d'un message texte dans le fil supervisé à trois
   * 1. Vérifie l'état du fil (pause, clôture, blocage)
   * 2. Contrôle anti-flood (20 msg/min max)
   * 3. Enregistre le message (immuable, pas de pièce jointe libre)
   * 4. Exécute la détection et enregistre les alertes sans bloquer
   * 5. Avance le curseur de lecture
   */
  public async sendMessage(
    conversationId: string,
    account: Account,
    input: SendMessageRequest,
  ): Promise<{ message: ConversationMessage; detectionsCount: number }> {
    const rawConv = this.store.conversations.get(conversationId);
    if (!rawConv) {
      const err: MessagingServiceError = {
        status: 404,
        code: "CONVERSATION_NOT_FOUND",
        message: "Conversation introuvable",
      };
      throw err;
    }

    const conv = { ...(rawConv as unknown as Conversation) };

    // Vérifier l'appartenance à la conversation
    const isParticipant = conv.participants.some(
      (p) => p.accountId === account.id,
    );
    const isAgent = account.role === "agent" || account.role === "admin";

    if (!isParticipant && !isAgent) {
      const err: MessagingServiceError = {
        status: 403,
        code: "FORBIDDEN",
        message: "Vous ne participez pas à cette conversation",
      };
      throw err;
    }

    // RG15 / RG39 : Vérification de l'état du fil
    if (conv.status === "close" || conv.status === "archivee") {
      const err: MessagingServiceError = {
        status: 400,
        code: "CONVERSATION_CLOSED",
        message:
          "Cette conversation est clôturée, aucun nouveau message ne peut être envoyé",
      };
      throw err;
    }

    if (conv.status === "en_pause" && !isAgent) {
      const err: MessagingServiceError = {
        status: 400,
        code: "CONVERSATION_PAUSED",
        message:
          "Cette négociation est temporairement suspendue par un commercial INFLUX (seul le commercial peut écrire)",
      };
      throw err;
    }

    // RG40 : Plafond anti-abus (20 messages par minute par compte)
    const existingMessages = this.store.messages.get(conversationId) || [];
    const oneMinuteAgo = Date.now() - 60 * 1000;
    const recentMessagesCount = existingMessages.filter((m) => {
      const raw = m as unknown as ConversationMessage;
      return (
        raw.senderAccountId === account.id &&
        new Date(raw.createdAt).getTime() > oneMinuteAgo
      );
    }).length;

    if (recentMessagesCount >= 20) {
      const err: MessagingServiceError = {
        status: 429,
        code: "RATE_LIMIT_EXCEEDED",
        message:
          "Plafond anti-abus atteint : vous ne pouvez pas envoyer plus de 20 messages par minute",
      };
      throw err;
    }

    const trimmedContent = input.content.trim();
    if (trimmedContent.length < 1 || trimmedContent.length > 10000) {
      const err: MessagingServiceError = {
        status: 400,
        code: "INVALID_LENGTH",
        message: "Le message doit comporter entre 1 et 10 000 caractères",
      };
      throw err;
    }

    // Détermination du rôle et nom affiché de l'émetteur
    let senderRole: "advertiser" | "creator" | "agent" = "advertiser";
    if (account.role === "creator") senderRole = "creator";
    if (account.role === "agent" || account.role === "admin")
      senderRole = "agent";

    // Contrôle d'accès strict au canal (Cloisonnement bilatéral)
    const channel: ConversationChannel = input.channel || "three_way";
    if (
      channel === "agent_advertiser" &&
      senderRole !== "agent" &&
      senderRole !== "advertiser"
    ) {
      const err: MessagingServiceError = {
        status: 403,
        code: "FORBIDDEN_CHANNEL",
        message:
          "Seuls le commercial INFLUX et l'annonceur peuvent accéder et écrire dans le canal privé marque",
      };
      throw err;
    }

    if (
      channel === "agent_creator" &&
      senderRole !== "agent" &&
      senderRole !== "creator"
    ) {
      const err: MessagingServiceError = {
        status: 403,
        code: "FORBIDDEN_CHANNEL",
        message:
          "Seuls le commercial INFLUX et le créateur peuvent accéder et écrire dans le canal privé créateur",
      };
      throw err;
    }

    // Nom affiché (RG5 & RG6)
    let senderDisplayName = account.email.split("@")[0] || "Membre";
    if (senderRole === "advertiser") {
      const brand = this.store.brandProfiles.get(account.id) as
        { companyName?: string } | undefined;
      senderDisplayName =
        brand?.companyName || senderDisplayName || "Annonceur";
    } else if (senderRole === "creator") {
      const creator = this.store.creatorProfiles.get(account.id) as
        { legalName?: string; publicHandle?: string } | undefined;
      senderDisplayName =
        creator?.publicHandle ||
        creator?.legalName ||
        senderDisplayName ||
        "Créateur";
    } else {
      senderDisplayName = "Alexandre — INFLUX";
    }

    const now = new Date().toISOString();
    const messageId = randomUUID();

    const message: ConversationMessage = {
      id: messageId,
      conversationId: conv.id,
      channel,
      senderAccountId: account.id,
      senderRole,
      senderDisplayName,
      content: trimmedContent,
      createdAt: now,
    };

    const validatedMessage = ConversationMessageSchema.parse(message);

    // Sauvegarde immuable du message
    existingMessages.push(
      validatedMessage as unknown as Record<string, unknown>,
    );
    this.store.messages.set(conv.id, existingMessages);

    // RG16 : Passage automatique de "ouverte" à "active" au premier message
    if (conv.status === "ouverte") {
      conv.status = "active";
    }
    conv.updatedAt = now;

    // Avancement du curseur de lecture pour l'émetteur (RG51, RG52)
    const participantIndex = conv.participants.findIndex(
      (p) => p.accountId === account.id,
    );
    const participant = conv.participants[participantIndex];
    if (participant) {
      conv.participants[participantIndex] = {
        ...participant,
        lastReadMessageId: messageId,
        lastReadAt: now,
      };
    }

    this.store.conversations.set(
      conv.id,
      conv as unknown as Record<string, unknown>,
    );

    // RG45 & RG46 : Détection de coordonnées et enregistrement d'alerte (non bloquante)
    const detectedSpans = this.detectContactInfo(trimmedContent);

    for (const span of detectedSpans) {
      const detectionId = randomUUID();
      const detection: ContactDetection = {
        id: detectionId,
        messageId,
        conversationId: conv.id,
        senderAccountId: account.id,
        senderRole,
        detectedType: span.detectedType,
        startIndex: span.startIndex,
        endIndex: span.endIndex,
        detectorVersion: "v1.0",
        warnedBeforeSend: Boolean(input.warnedBeforeSend),
        sentAnyway: Boolean(input.sentAnyway),
        status: "pending",
        createdAt: now,
      };

      const validatedDetection = ContactDetectionSchema.parse(detection);
      this.store.contactDetections.set(
        detectionId,
        validatedDetection as unknown as Record<string, unknown>,
      );
    }

    if (detectedSpans.length > 0) {
      this.store.recordAuditEvent(
        "contact_detection.flagged",
        {
          conversationId: conv.id,
          messageId,
          senderAccountId: account.id,
          detectionsCount: detectedSpans.length,
          detectedTypes: detectedSpans.map((d) => d.detectedType),
        },
        account.id,
      );
    }

    return {
      message: validatedMessage,
      detectionsCount: detectedSpans.length,
    };
  }

  /**
   * Récupération des informations d'une conversation
   */
  /**
   * Journalisation obligatoire de la lecture d'un fil par un agent (RG55 à RG61, A10)
   * - Agent participant : motif "suivi_de_l_affaire" automatique
   * - Agent externe : motif typé explicite obligatoire avant lecture (RG57)
   * - Jamais de stockage du contenu des messages (RG58)
   */
  public async recordAgentAccess(
    conversation: Conversation,
    account: Account,
    accessQuery?: AccessConversationQuery,
    messagesCount?: number,
  ): Promise<ConversationAccessLog | null> {
    if (account.role !== "agent" && account.role !== "admin") {
      return null;
    }

    const isParticipant = conversation.participants.some(
      (p) => p.accountId === account.id && p.role === "agent",
    );

    let reason: AgentAccessReason;
    let comment = accessQuery?.comment ?? null;

    if (isParticipant) {
      reason = accessQuery?.reason || "suivi_de_l_affaire";
    } else {
      if (!accessQuery?.reason) {
        const err: MessagingServiceError = {
          status: 400,
          code: "REASON_REQUIRED",
          message:
            "Un motif d'accès préalable typé est obligatoire pour consulter une conversation dont vous n'êtes pas le commercial assigné (RG57)",
        };
        throw err;
      }
      if (
        accessQuery.reason === "autre" &&
        (!comment || comment.trim().length < 5)
      ) {
        const err: MessagingServiceError = {
          status: 400,
          code: "COMMENT_REQUIRED",
          message:
            "Un commentaire explicatif d'au moins 5 caractères est obligatoire pour le motif d'accès 'autre' (RG56)",
        };
        throw err;
      }
      reason = accessQuery.reason;
    }

    const count =
      messagesCount ?? (this.store.messages.get(conversation.id)?.length || 0);
    const now = new Date().toISOString();
    const logId = randomUUID();

    const accessLog: ConversationAccessLog = {
      id: logId,
      conversationId: conversation.id,
      accountId: account.id,
      role: account.role as "agent" | "admin",
      reason,
      comment,
      isParticipant,
      sourceScreen: accessQuery?.sourceScreen || "conversation_view",
      messagesCount: count,
      timestamp: now,
    };

    const validatedLog = ConversationAccessLogSchema.parse(accessLog);
    this.store.conversationAccessLogs.set(
      logId,
      validatedLog as unknown as Record<string, unknown>,
    );

    this.store.recordAuditEvent(
      "conversation.accessed",
      {
        conversationId: conversation.id,
        agentId: account.id,
        role: account.role,
        reason,
        isParticipant,
        messagesCount: count,
      },
      account.id,
    );

    // Alerte RG61 : seuil de 40 conversations distinctes sur 24h
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const distinctConversations = new Set<string>();
    for (const raw of this.store.conversationAccessLogs.values()) {
      const item = raw as unknown as ConversationAccessLog;
      if (
        item.accountId === account.id &&
        new Date(item.timestamp).getTime() > oneDayAgo
      ) {
        distinctConversations.add(item.conversationId);
      }
    }
    if (distinctConversations.size > 40) {
      this.store.recordAuditEvent(
        "conversation_access_alert.threshold_exceeded",
        {
          agentId: account.id,
          distinctConversationsCount: distinctConversations.size,
          threshold: 40,
        },
        account.id,
      );
    }

    return validatedLog;
  }

  /**
   * Liste des conversations accessibles pour un compte (RG34)
   * Un membre ne voit que les conversations dont il est participant.
   * Un agent/admin peut voir toutes les conversations.
   */
  public async getMyConversations(account: Account): Promise<Conversation[]> {
    const list: Conversation[] = [];
    const isAgentOrAdmin = account.role === "agent" || account.role === "admin";

    for (const raw of this.store.conversations.values()) {
      const conv = { ...(raw as unknown as Conversation) };
      const allMsgs = (this.store.messages.get(conv.id) ||
        []) as unknown as ConversationMessage[];

      const allowedMsgs = allMsgs.filter((msg) => {
        const msgChannel = msg.channel || "three_way";
        if (isAgentOrAdmin) return true;
        if (account.role === "advertiser") {
          return (
            msgChannel === "three_way" || msgChannel === "agent_advertiser"
          );
        }
        if (account.role === "creator") {
          return msgChannel === "three_way" || msgChannel === "agent_creator";
        }
        return false;
      });

      if (allowedMsgs.length > 0) {
        conv.lastMessage = allowedMsgs[allowedMsgs.length - 1] ?? null;
      } else {
        conv.lastMessage = null;
      }

      if (isAgentOrAdmin) {
        list.push(conv);
      } else {
        const isParticipant = conv.participants.some(
          (p) => p.accountId === account.id && !p.leftAt,
        );
        if (isParticipant) {
          list.push(conv);
        }
      }
    }

    list.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    return list;
  }

  /**
   * Récupération des informations d'une conversation
   */
  public async getConversation(
    conversationId: string,
    account: Account,
    accessQuery?: AccessConversationQuery,
    skipLog: boolean = false,
  ): Promise<Conversation> {
    const raw = this.store.conversations.get(conversationId);
    if (!raw) {
      const err: MessagingServiceError = {
        status: 404,
        code: "CONVERSATION_NOT_FOUND",
        message: "Conversation introuvable",
      };
      throw err;
    }

    const conv = raw as unknown as Conversation;
    const isParticipant = conv.participants.some(
      (p) => p.accountId === account.id,
    );
    const isAgent = account.role === "agent" || account.role === "admin";

    if (!isParticipant && !isAgent) {
      const err: MessagingServiceError = {
        status: 403,
        code: "FORBIDDEN",
        message: "Accès refusé à cette conversation",
      };
      throw err;
    }

    if (!skipLog) {
      await this.recordAgentAccess(conv, account, accessQuery);
    }

    return conv;
  }

  /**
   * Consultation des messages et actualisation du curseur de lecture
   */
  public async getMessages(
    conversationId: string,
    account: Account,
    accessQuery?: AccessConversationQuery,
    channelFilter?: ConversationChannel | "all",
  ): Promise<{
    conversation: Conversation;
    messages: ConversationMessage[];
    accessLog?: ConversationAccessLog | null;
  }> {
    const conv = await this.getConversation(
      conversationId,
      account,
      accessQuery,
      true,
    );
    const rawList = this.store.messages.get(conversationId) || [];
    const allMessages = rawList as unknown as ConversationMessage[];

    const isAgentOrAdmin = account.role === "agent" || account.role === "admin";
    const isAdvertiser = account.role === "advertiser";
    const isCreator = account.role === "creator";

    // 1. Filtrage hermétique de sécurité selon le rôle
    const allowedMessages = allMessages.filter((msg) => {
      const msgChannel = msg.channel || "three_way";
      if (isAgentOrAdmin) return true;
      if (isAdvertiser) {
        return msgChannel === "three_way" || msgChannel === "agent_advertiser";
      }
      if (isCreator) {
        return msgChannel === "three_way" || msgChannel === "agent_creator";
      }
      return false;
    });

    // 2. Filtrage secondaire par canal sélectionné
    const messages =
      channelFilter && channelFilter !== "all"
        ? allowedMessages.filter(
            (m) => (m.channel || "three_way") === channelFilter,
          )
        : allowedMessages;

    // Journalisation de la lecture avec le nombre effectif de messages (RG55, RG58)
    const accessLog = await this.recordAgentAccess(
      conv,
      account,
      accessQuery,
      messages.length,
    );

    // Avancement du curseur de lecture pour les participants (RG51, RG52)
    if (allowedMessages.length > 0) {
      const lastMsg = allowedMessages[allowedMessages.length - 1];
      if (lastMsg) {
        const now = new Date().toISOString();

        const participantIndex = conv.participants.findIndex(
          (p) => p.accountId === account.id,
        );
        const participant = conv.participants[participantIndex];
        if (participant) {
          conv.participants[participantIndex] = {
            ...participant,
            lastReadMessageId: lastMsg.id,
            lastReadAt: now,
          };
          this.store.conversations.set(
            conv.id,
            conv as unknown as Record<string, unknown>,
          );
        }
      }
    }

    return {
      conversation: conv,
      messages,
      accessLog,
    };
  }

  /**
   * Consultation du registre des lectures agents (RG59)
   * - Admin : voit toutes les lectures
   * - Agent : voit uniquement ses propres lectures
   * - Membre : accès strictement refusé (403)
   */
  public async getAccessLogs(
    account: Account,
    filters?: { conversationId?: string; agentId?: string },
  ): Promise<ConversationAccessLog[]> {
    if (account.role !== "agent" && account.role !== "admin") {
      const err: MessagingServiceError = {
        status: 403,
        code: "FORBIDDEN",
        message:
          "Seuls les commerciaux et administrateurs INFLUX peuvent consulter le registre des lectures (RG59)",
      };
      throw err;
    }

    const list: ConversationAccessLog[] = [];
    for (const raw of this.store.conversationAccessLogs.values()) {
      const item = raw as unknown as ConversationAccessLog;

      // RG59 : un agent ne voit que ses propres lectures
      if (account.role === "agent" && item.accountId !== account.id) {
        continue;
      }

      if (
        filters?.conversationId &&
        item.conversationId !== filters.conversationId
      ) {
        continue;
      }

      if (filters?.agentId && item.accountId !== filters.agentId) {
        continue;
      }

      list.push(item);
    }

    return list.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  /**
   * Consultation des détections de coordonnées pour le Backoffice commercial (RG50)
   */
  public async getDetections(
    conversationId: string,
    account: Account,
  ): Promise<ContactDetection[]> {
    if (account.role !== "agent" && account.role !== "admin") {
      const err: MessagingServiceError = {
        status: 403,
        code: "FORBIDDEN",
        message:
          "Seuls les commerciaux et administrateurs INFLUX peuvent consulter les détections",
      };
      throw err;
    }

    const list: ContactDetection[] = [];
    for (const raw of this.store.contactDetections.values()) {
      const item = raw as unknown as ContactDetection;
      if (item.conversationId === conversationId) {
        list.push(item);
      }
    }

    return list.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }

  /**
   * Mise en pause d'une conversation par un commercial (RG17, RG18)
   */
  public async pauseConversation(
    conversationId: string,
    account: Account,
    reason: string,
  ): Promise<Conversation> {
    if (account.role !== "agent" && account.role !== "admin") {
      const err: MessagingServiceError = {
        status: 403,
        code: "FORBIDDEN",
        message:
          "Seuls les commerciaux et administrateurs INFLUX peuvent suspendre une conversation",
      };
      throw err;
    }

    const raw = this.store.conversations.get(conversationId);
    if (!raw) {
      const err: MessagingServiceError = {
        status: 404,
        code: "CONVERSATION_NOT_FOUND",
        message: "Conversation introuvable",
      };
      throw err;
    }

    const conv = raw as unknown as Conversation;
    conv.status = "en_pause";
    conv.pauseReason = reason;
    conv.updatedAt = new Date().toISOString();
    this.store.conversations.set(conversationId, conv);

    const actor = conv.participants.find((p) => p.accountId === account.id);
    const actorName =
      actor?.displayName ||
      (account.role === "agent" ? "le commercial INFLUX" : account.email);

    // Émettre un message système (RG14)
    const sysMsg: ConversationMessage = {
      id: randomUUID(),
      conversationId,
      channel: "three_way",
      senderAccountId: account.id,
      senderRole: "system",
      senderDisplayName: "Système INFLUX",
      content: `La négociation a été suspendue temporairement par ${actorName}.`,
      systemCode: "conversation.paused",
      createdAt: conv.updatedAt,
    };
    const list = this.store.messages.get(conversationId) || [];
    list.push(sysMsg);
    this.store.messages.set(conversationId, list);

    return conv;
  }

  /**
   * Reprise d'une conversation en pause (RG19)
   */
  public async resumeConversation(
    conversationId: string,
    account: Account,
  ): Promise<Conversation> {
    if (account.role !== "agent" && account.role !== "admin") {
      const err: MessagingServiceError = {
        status: 403,
        code: "FORBIDDEN",
        message:
          "Seuls les commerciaux et administrateurs INFLUX peuvent reprendre une conversation",
      };
      throw err;
    }

    const raw = this.store.conversations.get(conversationId);
    if (!raw) {
      const err: MessagingServiceError = {
        status: 404,
        code: "CONVERSATION_NOT_FOUND",
        message: "Conversation introuvable",
      };
      throw err;
    }

    const conv = raw as unknown as Conversation;
    conv.status = "active";
    conv.pauseReason = null;
    conv.updatedAt = new Date().toISOString();
    this.store.conversations.set(conversationId, conv);

    // Émettre un message système (RG14)
    const sysMsg: ConversationMessage = {
      id: randomUUID(),
      conversationId,
      channel: "three_way",
      senderAccountId: account.id,
      senderRole: "system",
      senderDisplayName: "Système INFLUX",
      content: `La négociation a repris.`,
      systemCode: "conversation.resumed",
      createdAt: conv.updatedAt,
    };
    const list = this.store.messages.get(conversationId) || [];
    list.push(sysMsg);
    this.store.messages.set(conversationId, list);

    return conv;
  }

  /**
   * Clôture d'une conversation avec motif typé obligatoire (RG20)
   */
  public async closeConversation(
    conversationId: string,
    account: Account,
    reason: ConversationCloseReason,
    comment?: string,
  ): Promise<Conversation> {
    if (account.role !== "agent" && account.role !== "admin") {
      const err: MessagingServiceError = {
        status: 403,
        code: "FORBIDDEN",
        message:
          "Seuls les commerciaux et administrateurs INFLUX peuvent clore une conversation",
      };
      throw err;
    }

    const raw = this.store.conversations.get(conversationId);
    if (!raw) {
      const err: MessagingServiceError = {
        status: 404,
        code: "CONVERSATION_NOT_FOUND",
        message: "Conversation introuvable",
      };
      throw err;
    }

    const conv = raw as unknown as Conversation;
    conv.status = "close";
    conv.closeReason = reason;
    conv.closeComment = comment || null;
    conv.updatedAt = new Date().toISOString();
    this.store.conversations.set(conversationId, conv);

    const actor = conv.participants.find((p) => p.accountId === account.id);
    const actorName =
      actor?.displayName ||
      (account.role === "agent" ? "le commercial INFLUX" : account.email);

    // Émettre un message système (RG14)
    const sysMsg: ConversationMessage = {
      id: randomUUID(),
      conversationId,
      channel: "three_way",
      senderAccountId: account.id,
      senderRole: "system",
      senderDisplayName: "Système INFLUX",
      content: `La conversation a été clôturée par ${actorName}.`,
      systemCode: "conversation.closed",
      createdAt: conv.updatedAt,
    };
    const list = this.store.messages.get(conversationId) || [];
    list.push(sysMsg);
    this.store.messages.set(conversationId, list);

    return conv;
  }

  /**
   * Classement d'une détection de coordonnées par l'agent (RG50)
   */
  public async classifyDetection(
    detectionId: string,
    account: Account,
    classification: "legitimate" | "circumvention_suspected" | "false_positive",
  ): Promise<ContactDetection> {
    if (account.role !== "agent" && account.role !== "admin") {
      const err: MessagingServiceError = {
        status: 403,
        code: "FORBIDDEN",
        message:
          "Seuls les commerciaux et administrateurs INFLUX peuvent classifier les détections",
      };
      throw err;
    }

    const raw = this.store.contactDetections.get(detectionId);
    if (!raw) {
      const err: MessagingServiceError = {
        status: 404,
        code: "DETECTION_NOT_FOUND",
        message: "Détection introuvable",
      };
      throw err;
    }

    const detection = raw as unknown as ContactDetection;
    detection.status = "reviewed";
    detection.classification = classification;
    this.store.contactDetections.set(detectionId, detection);

    return detection;
  }
}
