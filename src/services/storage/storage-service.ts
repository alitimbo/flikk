import { FirebaseService } from "@/services/firebase/firebase-service";

export type UploadKind = "video" | "image";

export type UploadItem = {
  uri: string;
  kind: UploadKind;
  pathPrefix?: string;
  fileName?: string;
  contentType?: string;
  metadata?: Record<string, string>;
};

export type UploadResult = {
  index: number;
  path: string;
  downloadUrl: string;
};

export class StorageService {
  static async uploadMany(items: UploadItem[]) {
    const results = await Promise.allSettled(
      items.map((item, index) =>
        this.uploadOne(item).then((result) => ({ ...result, index }))
      )
    );

    const fulfilled = results
      .filter((r): r is PromiseFulfilledResult<UploadResult> => r.status === "fulfilled")
      .map((r) => r.value);

    const rejected = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r, index) => ({ index, error: r.reason }));

    return { fulfilled, rejected };
  }

  static async uploadManyForProcessing(items: UploadItem[]) {
    const results = await Promise.allSettled(
      items.map((item, index) =>
        this.uploadForProcessing(item).then((result) => ({ ...result, index }))
      )
    );

    const fulfilled = results
      .filter((r): r is PromiseFulfilledResult<UploadResult> => r.status === "fulfilled")
      .map((r) => r.value);

    const rejected = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r, index) => ({ index, error: r.reason }));

    return { fulfilled, rejected };
  }

  static async uploadOne(item: UploadItem) {
    const extension = getRequiredExtension(item.kind);
    const contentType = item.contentType ?? getRequiredContentType(item.kind);
    const fileName = normalizeFileName(item.fileName ?? generateFileName(extension), extension);
    const path = buildPath(item.pathPrefix, fileName);

    ensureUriHasExtension(item.uri, extension);

    const ref = FirebaseService.storage.ref(path);
    await ref.putFile(item.uri, {
      contentType,
      customMetadata: item.metadata,
    });
    const downloadUrl = await ref.getDownloadURL();

    return { path, downloadUrl };
  }

  static async uploadForProcessing(item: UploadItem) {
    const extension = extractExtension(item.uri);
    const contentType = item.contentType ?? guessContentType(extension) ?? "application/octet-stream";
    const fileName = normalizeFileName(item.fileName ?? generateRawFileName(extension), extension);
    const path = buildPath(item.pathPrefix ?? "uploads/raw", fileName);

    const ref = FirebaseService.storage.ref(path);
    await ref.putFile(item.uri, {
      contentType,
      customMetadata: {
        ...item.metadata,
        "flikk:kind": item.kind,
        "flikk:desiredFormat": getRequiredExtension(item.kind),
        "flikk:originalExtension": extension ?? "unknown",
      },
    });
    const downloadUrl = await ref.getDownloadURL();

    return { path, downloadUrl };
  }
}

function getRequiredExtension(kind: UploadKind) {
  return kind === "video" ? "mp4" : "png";
}

function getRequiredContentType(kind: UploadKind) {
  return kind === "video" ? "video/mp4" : "image/png";
}

function generateFileName(extension: string) {
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${stamp}-${rand}.${extension}`;
}

function generateRawFileName(extension: string | null) {
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  if (!extension) return `${stamp}-${rand}`;
  return `${stamp}-${rand}.${extension}`;
}

function normalizeFileName(fileName: string, extension: string) {
  const clean = fileName.trim();
  if (!clean) return generateFileName(extension);
  if (clean.toLowerCase().endsWith(`.${extension}`)) return clean;
  return `${clean}.${extension}`;
}

function buildPath(pathPrefix: string | undefined, fileName: string) {
  const prefix = pathPrefix?.replace(/\/+$/, "");
  if (!prefix) return fileName;
  return `${prefix}/${fileName}`;
}

function ensureUriHasExtension(uri: string, extension: string) {
  const lower = uri.toLowerCase();
  if (!lower.includes(`.${extension}`)) {
    throw new Error(
      `Invalid file extension. Expected .${extension} for ${uri}`
    );
  }
}

function extractExtension(uri: string) {
  const clean = uri.split("?")[0];
  const match = /\.(\w+)$/.exec(clean);
  return match?.[1]?.toLowerCase() ?? null;
}

function guessContentType(extension: string | null) {
  if (!extension) return null;
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  if (extension === "heic") return "image/heic";
  if (extension === "mp4") return "video/mp4";
  if (extension === "mov") return "video/quicktime";
  if (extension === "mkv") return "video/x-matroska";
  if (extension === "webm") return "video/webm";
  return null;
}
