import { randomUUID } from "node:crypto";
import {
  type Account,
  type StorageBucket,
  type AllowedImageContentType,
  type SignedUploadUrlRequest,
  type SignedUploadUrlResponse,
  type UploadFileResponse,
  SignedUploadUrlRequestSchema,
  SignedUploadUrlResponseSchema,
  UploadFileResponseSchema,
} from "@influx/contracts";
import { MockStore } from "../mocks/mock-store";

export interface StoredFileRecord {
  id: string;
  accountId: string;
  bucket: StorageBucket;
  storagePath: string;
  contentType: AllowedImageContentType;
  sizeBytes: number;
  data: string;
  exifStripped: boolean;
  expiresAt: number;
  isUploaded: boolean;
  uploadedAt?: string;
  createdAt: string;
}

export class StorageService {
  private store: MockStore;

  constructor(store?: MockStore) {
    this.store = store ?? MockStore.getInstance();
  }

  /**
   * Génère une URL signée pour le téléversement direct d'un fichier (E1)
   * Invariant E1 : Le chemin est TOUJOURS calculé par le serveur, JAMAIS le nom de fichier d'origine.
   * L'URL a une durée de vie courte (<= 5 min).
   */
  generateSignedUploadUrl(
    account: Account,
    input: SignedUploadUrlRequest,
  ): SignedUploadUrlResponse {
    const validated = SignedUploadUrlRequestSchema.parse(input);

    // Contrôle E1-9 : le compartiment verification n'accepte que image/png ou image/jpeg
    if (
      validated.bucket === "verification" &&
      validated.contentType === "image/webp"
    ) {
      throw new Error(
        "Le compartiment de vérification n'accepte que les formats PNG et JPEG",
      );
    }

    const fileId = randomUUID();
    const ext = validated.contentType.split("/")[1] || "png";
    // Chemin opaque et anonymisé : compartiment / UUID . extension (RG80, E1)
    const storagePath = `${validated.bucket}/${fileId}.${ext}`;
    const expiresInSeconds = 300; // 5 minutes

    const record: StoredFileRecord = {
      id: fileId,
      accountId: account.id,
      bucket: validated.bucket,
      storagePath,
      contentType: validated.contentType,
      sizeBytes: validated.sizeBytes ?? 0,
      data: "",
      exifStripped: true, // EXIF purgés par conception
      expiresAt: Date.now() + expiresInSeconds * 1000,
      isUploaded: false,
      createdAt: new Date().toISOString(),
    };

    this.store.storageFiles.set(fileId, record as any);

    // Journalisation d'audit de l'émission d'URL signée (E1)
    this.store.recordAuditEvent(
      "storage.signed_upload_url_generated",
      {
        fileId,
        accountId: account.id,
        bucket: validated.bucket,
        storagePath,
        contentType: validated.contentType,
      },
      account.id,
    );

    return SignedUploadUrlResponseSchema.parse({
      fileId,
      uploadUrl: `/api/storage/upload/${fileId}`,
      storagePath,
      expiresInSeconds,
    });
  }

  /**
   * Simule le téléversement d'un fichier et son ré-encodage sans EXIF (RG80, E1)
   */
  uploadFile(
    fileId: string,
    fileContent: {
      data?: string;
      contentType?: string;
      sizeBytes?: number;
    },
  ): UploadFileResponse {
    const raw = this.store.storageFiles.get(fileId);
    if (!raw) {
      throw new Error("Autorisation de téléversement introuvable ou expirée");
    }

    const record = raw as unknown as StoredFileRecord;

    if (Date.now() > record.expiresAt) {
      throw new Error("L'URL de téléversement a expiré (durée max 5 min)");
    }

    const now = new Date().toISOString();
    const sizeBytes =
      fileContent.sizeBytes ??
      (fileContent.data ? Buffer.byteLength(fileContent.data) : 1024);

    // Limite de taille 5 Mo (RG77, E1)
    if (sizeBytes > 5 * 1024 * 1024) {
      throw new Error(
        "La taille du fichier dépasse la limite autorisée de 5 Mo",
      );
    }

    const updated: StoredFileRecord = {
      ...record,
      data: fileContent.data || "data:image/png;base64,mockImageData",
      sizeBytes,
      isUploaded: true,
      exifStripped: true, // Ré-encodage garanti pour supprimer les métadonnées (RG80)
      uploadedAt: now,
    };

    this.store.storageFiles.set(fileId, updated as any);

    // Journalisation de la réception du fichier
    this.store.recordAuditEvent(
      "storage.file_uploaded",
      {
        fileId,
        accountId: updated.accountId,
        bucket: updated.bucket,
        storagePath: updated.storagePath,
        sizeBytes,
        exifStripped: true,
      },
      updated.accountId,
    );

    return UploadFileResponseSchema.parse({
      fileId,
      storagePath: updated.storagePath,
      publicUrl: `/api/storage/files/${fileId}`,
      contentType: updated.contentType,
      sizeBytes,
      exifStripped: true,
    });
  }

  /**
   * Consultation d'un fichier stocké avec contrôle de sécurité strict (E1)
   * Exception E1 : La lecture d'une pièce de vérification ne passe JAMAIS par une URL signée
   * remise au navigateur ; elle transite par apps/api et journalise nominativement chaque consultation.
   */
  getFile(fileId: string, viewerAccount?: Account): StoredFileRecord {
    const raw = this.store.storageFiles.get(fileId);
    if (!raw) {
      throw new Error("Fichier introuvable");
    }

    const record = raw as unknown as StoredFileRecord;
    if (!record.isUploaded) {
      throw new Error("Fichier non encore téléversé");
    }

    // Contrôle d'accès strict pour le compartiment de vérification (E1, RG54)
    if (record.bucket === "verification") {
      if (!viewerAccount) {
        throw new Error(
          "Authentification requise pour accéder aux pièces de vérification",
        );
      }

      const isAgentOrAdmin =
        viewerAccount.role === "agent" || viewerAccount.role === "admin";
      const isOwner = viewerAccount.id === record.accountId;

      // Une marque ne peut JAMAIS accéder à une pièce de vérification (RG54)
      if (!isAgentOrAdmin && !isOwner) {
        throw new Error(
          "Accès strictement interdit aux pièces de vérification (données confidentielles de tiers)",
        );
      }

      // Tout accès d'un agent est journalisé nominativement (E1, 04 §5.3)
      if (isAgentOrAdmin && !isOwner) {
        this.store.recordAuditEvent(
          "verification.evidence_viewed",
          {
            fileId,
            targetAccountId: record.accountId,
            agentId: viewerAccount.id,
            storagePath: record.storagePath,
          },
          viewerAccount.id,
        );
      }
    }

    return record;
  }
}

export const storageService = new StorageService();
