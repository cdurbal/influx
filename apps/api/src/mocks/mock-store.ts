import {
  type Account,
  type ConsentEvent,
  type TermsAcceptance,
} from "@influx/contracts";
import { createInitialSnapshot } from "./seed-data";

export interface AuditEventRecord {
  id: string;
  eventType: string;
  accountId?: string | null;
  payload: Record<string, unknown>;
  timestamp: string;
  previousHash: string;
  hash: string;
}

export interface OutboxEventRecord {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: "pending" | "synced" | "failed";
  attempts: number;
  lastError?: string | null;
  createdAt: string;
}

export interface MockStoreSnapshot {
  accounts: Account[];
  termsAcceptances: TermsAcceptance[];
  consentEvents: ConsentEvent[];
  brandProfiles: Record<string, unknown>[];
  creatorProfiles: Record<string, unknown>[];
  campaigns: Record<string, unknown>[];
  introductions: Record<string, unknown>[];
  conversations: Record<string, unknown>[];
  messages: Record<string, unknown>[];
  deals: Record<string, unknown>[];
  verificationRequests: Record<string, unknown>[];
  ownershipCodes?: Record<string, unknown>[];
  badges?: Record<string, unknown>[];
  searchQueries?: Record<string, unknown>[];
  searchImpressions?: Record<string, unknown>[];
  shortlists?: Record<string, unknown>[];
  shortlistItems?: Record<string, unknown>[];
  teamSelectionRequests?: Record<string, unknown>[];
  userBlocks?: Record<string, unknown>[];
  auditEvents: AuditEventRecord[];
  outboxEvents: OutboxEventRecord[];
}

export class MockStore {
  private static instance: MockStore | null = null;

  public accounts = new Map<string, Account>();
  public termsAcceptances = new Map<string, TermsAcceptance>();
  public consentEvents = new Map<string, ConsentEvent>();
  public brandProfiles = new Map<string, Record<string, unknown>>();
  public creatorProfiles = new Map<string, Record<string, unknown>>();
  public campaigns = new Map<string, Record<string, unknown>>();
  public introductions = new Map<string, Record<string, unknown>>();
  public conversations = new Map<string, Record<string, unknown>>();
  public messages = new Map<string, Record<string, unknown>[]>();
  public deals = new Map<string, Record<string, unknown>>();
  public contactDetections = new Map<string, Record<string, unknown>>();
  public conversationAccessLogs = new Map<string, Record<string, unknown>>();
  public verificationRequests = new Map<string, Record<string, unknown>>();
  public ownershipCodes = new Map<string, Record<string, unknown>>();
  public badges = new Map<string, Record<string, unknown>>();
  public storageFiles = new Map<string, Record<string, unknown>>();
  public searchQueries = new Map<string, Record<string, unknown>>();
  public searchImpressions = new Map<string, Record<string, unknown>[]>();
  public shortlists = new Map<string, Record<string, unknown>>();
  public shortlistItems = new Map<string, Record<string, unknown>[]>();
  public teamSelectionRequests = new Map<string, Record<string, unknown>>();
  public userBlocks = new Map<string, Record<string, unknown>>();
  public searchSettings = {
    isOpenToAdvertisers: true,
    kAnonymityThreshold: 5,
    pageSize: 12,
    maxPages: 5,
    coldProfileQuota: 2,
  };
  public auditEvents: AuditEventRecord[] = [];
  public outboxEvents: OutboxEventRecord[] = [];

  private constructor() {
    this.reset();
  }

  public static getInstance(): MockStore {
    if (!MockStore.instance) {
      MockStore.instance = new MockStore();
    }
    return MockStore.instance;
  }

  public reset(
    options?:
      | { empty?: boolean; snapshot?: Partial<MockStoreSnapshot> }
      | Partial<MockStoreSnapshot>,
  ): void {
    this.accounts.clear();
    this.termsAcceptances.clear();
    this.consentEvents.clear();
    this.brandProfiles.clear();
    this.creatorProfiles.clear();
    this.campaigns.clear();
    this.introductions.clear();
    this.conversations.clear();
    this.messages.clear();
    this.deals.clear();
    this.contactDetections.clear();
    this.conversationAccessLogs.clear();
    this.verificationRequests.clear();
    this.ownershipCodes.clear();
    this.badges.clear();
    this.storageFiles.clear();
    this.searchQueries.clear();
    this.searchImpressions.clear();
    this.shortlists.clear();
    this.shortlistItems.clear();
    this.teamSelectionRequests.clear();
    this.userBlocks.clear();
    this.searchSettings = {
      isOpenToAdvertisers: true,
      kAnonymityThreshold: 5,
      pageSize: 12,
      maxPages: 5,
      coldProfileQuota: 2,
    };
    this.auditEvents = [];
    this.outboxEvents = [];

    if (!options) {
      this.load(createInitialSnapshot());
      return;
    }

    if ("empty" in options && options.empty) {
      return;
    }

    if ("snapshot" in options && options.snapshot) {
      this.load(options.snapshot);
      return;
    }

    if (!("empty" in options) && !("snapshot" in options)) {
      this.load(options as Partial<MockStoreSnapshot>);
      return;
    }

    this.load(createInitialSnapshot());
  }

  public dump(): MockStoreSnapshot {
    return {
      accounts: Array.from(this.accounts.values()),
      termsAcceptances: Array.from(this.termsAcceptances.values()),
      consentEvents: Array.from(this.consentEvents.values()),
      brandProfiles: Array.from(this.brandProfiles.values()),
      creatorProfiles: Array.from(this.creatorProfiles.values()),
      campaigns: Array.from(this.campaigns.values()),
      introductions: Array.from(this.introductions.values()),
      conversations: Array.from(this.conversations.values()),
      messages: Array.from(this.messages.values()).flat(),
      deals: Array.from(this.deals.values()),
      verificationRequests: Array.from(this.verificationRequests.values()),
      ownershipCodes: Array.from(this.ownershipCodes.values()),
      badges: Array.from(this.badges.values()),
      searchQueries: Array.from(this.searchQueries.values()),
      searchImpressions: Array.from(this.searchImpressions.values()).flat(),
      shortlists: Array.from(this.shortlists.values()),
      shortlistItems: Array.from(this.shortlistItems.values()).flat(),
      teamSelectionRequests: Array.from(this.teamSelectionRequests.values()),
      userBlocks: Array.from(this.userBlocks.values()),
      auditEvents: [...this.auditEvents],
      outboxEvents: [...this.outboxEvents],
    };
  }

  public load(snapshot: Partial<MockStoreSnapshot>): void {
    if (snapshot.accounts) {
      for (const item of snapshot.accounts) {
        this.accounts.set(item.id, item);
      }
    }
    if (snapshot.termsAcceptances) {
      for (const item of snapshot.termsAcceptances) {
        this.termsAcceptances.set(item.id, item);
      }
    }
    if (snapshot.consentEvents) {
      for (const item of snapshot.consentEvents) {
        this.consentEvents.set(item.id, item);
      }
    }
    if (snapshot.brandProfiles) {
      for (const item of snapshot.brandProfiles) {
        const id = (item.accountId || item.id) as string;
        if (id) this.brandProfiles.set(id, item);
      }
    }
    if (snapshot.creatorProfiles) {
      for (const item of snapshot.creatorProfiles) {
        const id = (item.accountId || item.id) as string;
        if (id) this.creatorProfiles.set(id, item);
      }
    }
    if (snapshot.campaigns) {
      for (const item of snapshot.campaigns) {
        const id = item.id as string;
        if (id) this.campaigns.set(id, item);
      }
    }
    if (snapshot.introductions) {
      for (const item of snapshot.introductions) {
        const id = item.id as string;
        if (id) this.introductions.set(id, item);
      }
    }
    if (snapshot.conversations) {
      for (const item of snapshot.conversations) {
        const id = item.id as string;
        if (id) this.conversations.set(id, item);
      }
    }
    if (snapshot.messages) {
      for (const item of snapshot.messages) {
        const convId = item.conversationId as string;
        if (convId) {
          const list = this.messages.get(convId) || [];
          list.push(item);
          this.messages.set(convId, list);
        }
      }
    }
    if (snapshot.deals) {
      for (const item of snapshot.deals) {
        const id = item.id as string;
        if (id) this.deals.set(id, item);
      }
    }
    if (snapshot.verificationRequests) {
      for (const item of snapshot.verificationRequests) {
        const id = item.id as string;
        if (id) this.verificationRequests.set(id, item);
      }
    }
    if (snapshot.ownershipCodes) {
      for (const item of snapshot.ownershipCodes) {
        const id = item.id as string;
        if (id) this.ownershipCodes.set(id, item);
      }
    }
    if (snapshot.badges) {
      for (const item of snapshot.badges) {
        const id = item.id as string;
        if (id) this.badges.set(id, item);
      }
    }
    if (snapshot.searchQueries) {
      for (const item of snapshot.searchQueries) {
        const id = item.id as string;
        if (id) this.searchQueries.set(id, item);
      }
    }
    if (snapshot.searchImpressions) {
      for (const item of snapshot.searchImpressions) {
        const qId = item.searchQueryId as string;
        if (qId) {
          const list = this.searchImpressions.get(qId) || [];
          list.push(item);
          this.searchImpressions.set(qId, list);
        }
      }
    }
    if (snapshot.shortlists) {
      for (const item of snapshot.shortlists) {
        const id = item.id as string;
        if (id) this.shortlists.set(id, item);
      }
    }
    if (snapshot.shortlistItems) {
      for (const item of snapshot.shortlistItems) {
        const sId = item.shortlistId as string;
        if (sId) {
          const list = this.shortlistItems.get(sId) || [];
          list.push(item);
          this.shortlistItems.set(sId, list);
        }
      }
    }
    if (snapshot.teamSelectionRequests) {
      for (const item of snapshot.teamSelectionRequests) {
        const id = item.id as string;
        if (id) this.teamSelectionRequests.set(id, item);
      }
    }
    if (snapshot.userBlocks) {
      for (const item of snapshot.userBlocks) {
        const id =
          (item.id as string) ||
          `${item.blockerAccountId}_${item.blockedAccountId}`;
        this.userBlocks.set(id, item);
      }
    }
    if (snapshot.auditEvents) {
      this.auditEvents = [...snapshot.auditEvents];
    }
    if (snapshot.outboxEvents) {
      this.outboxEvents = [...snapshot.outboxEvents];
    }
  }

  // Helper methods for accounts
  public getAccountById(id: string): Account | undefined {
    return this.accounts.get(id);
  }

  public getAccountByEmail(email: string): Account | undefined {
    const normalized = email.toLowerCase();
    for (const acc of this.accounts.values()) {
      if (acc.email.toLowerCase() === normalized) {
        return acc;
      }
    }
    return undefined;
  }

  public saveAccount(account: Account): void {
    this.accounts.set(account.id, account);
  }

  // Helper for append-only audit events
  public recordAuditEvent(
    eventType: string,
    payload: Record<string, unknown>,
    accountId?: string | null,
  ): AuditEventRecord {
    const previous = this.auditEvents.at(-1);
    const previousHash = previous ? previous.hash : "0000000000000000";
    const timestamp = new Date().toISOString();
    const id = `audit-${this.auditEvents.length + 1}`;
    const hash = `hash-${id}-${timestamp}`;

    const record: AuditEventRecord = {
      id,
      eventType,
      accountId: accountId ?? null,
      payload,
      timestamp,
      previousHash,
      hash,
    };

    this.auditEvents.push(record);
    return record;
  }
}
