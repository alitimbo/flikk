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
        this.uploadOne(item).then((result) => ({ ...result, index })),
      ),
    );

    const fulfilled = results
      .filter(
        (r): r is PromiseFulfilledResult<UploadResult> =>
          r.status === "fulfilled",
      )
      .map((r) => r.value);

    const rejected = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r, index) => ({ index, error: r.reason }));

    return { fulfilled, rejected };
  }

  static async uploadManyForProcessing(items: UploadItem[]) {
    const results = await Promise.allSettled(
      items.map((item, index) =>
        this.uploadForProcessing(item).then((result) => ({ ...result, index })),
      ),
    );

    const fulfilled = results
      .filter(
        (r): r is PromiseFulfilledResult<UploadResult> =>
          r.status === "fulfilled",
      )
      .map((r) => r.value);

    const rejected = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r, index) => ({ index, error: r.reason }));

    return { fulfilled, rejected };
  }

  static async uploadOne(item: UploadItem) {
    const originalExt = extractExtension(item.uri);
    const isAllowed = isAllowedExtension(originalExt, item.kind);

    // If original extension is allowed, use it. Otherwise, fallback to default.
    const extension =
      isAllowed && originalExt ? originalExt : getRequiredExtension(item.kind);
    const contentType =
      item.contentType ??
      guessContentType(extension) ??
      getRequiredContentType(item.kind);

    const fileName = normalizeFileName(
      item.fileName ?? generateFileName(extension),
      extension,
    );
    const path = buildPath(item.pathPrefix, fileName);

    // Only throw if the URI doesn't match any allowed extension for this kind
    ensureUriHasAllowedExtension(item.uri, item.kind);

    const ref = FirebaseService.storage.ref(path);
    await ref.putFile(item.uri, {
      contentType,
      customMetadata: sanitizeMetadata(item.metadata),
    });
    const downloadUrl = await ref.getDownloadURL();

    return { path, downloadUrl };
  }

  static async uploadForProcessing(item: UploadItem) {
    const extension = extractExtension(item.uri);
    const contentType =
      item.contentType ??
      guessContentType(extension) ??
      "application/octet-stream";
    const fileName = normalizeFileName(
      item.fileName ?? generateRawFileName(extension),
      extension,
    );

    // Crucial: Use the path the Cloud Function is listening for
    const folder =
      item.kind === "video" ? "uploads/raw/videos" : "uploads/raw/images";
    const path = buildPath(item.pathPrefix ?? folder, fileName);

    const ref = FirebaseService.storage.ref(path);
    await ref.putFile(item.uri, {
      contentType,
      customMetadata: sanitizeMetadata({
        ...item.metadata,
        "flikk:kind": item.kind,
        "flikk:desiredFormat":
          item.kind === "video" ? "hls" : getRequiredExtension(item.kind),
        "flikk:originalExtension": extension ?? "unknown",
      }),
    });
    const downloadUrl = await ref.getDownloadURL();

    return { path, downloadUrl };
  }

  static getRef(path: string) {
    return FirebaseService.storage.ref(path);
  }

  static async updateMetadata(path: string, metadata: Record<string, string>) {
    const ref = this.getRef(path);
    return await ref.updateMetadata({
      customMetadata: sanitizeMetadata(metadata),
    });
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

function normalizeFileName(fileName: string, extension: string | null) {
  const clean = fileName.trim();
  if (!clean) return generateRawFileName(extension);
  if (extension && clean.toLowerCase().endsWith(`.${extension}`)) return clean;
  if (!extension) return clean;
  return `${clean}.${extension}`;
}

function buildPath(pathPrefix: string | undefined, fileName: string) {
  const prefix = pathPrefix?.replace(/\/+$/, "");
  if (!prefix) return fileName;
  return `${prefix}/${fileName}`;
}

function isAllowedExtension(ext: string | null, kind: UploadKind) {
  if (!ext) return false;
  const imageExts = ["png", "jpg", "jpeg", "webp", "heic"];
  const videoExts = ["mp4", "mov", "mkv", "webm"];
  return kind === "image" ? imageExts.includes(ext) : videoExts.includes(ext);
}

function ensureUriHasAllowedExtension(uri: string, kind: UploadKind) {
  const ext = extractExtension(uri);
  if (!isAllowedExtension(ext, kind)) {
    const allowed = kind === "image" ? "png, jpg, webp" : "mp4, mov";
    throw new Error(
      `Invalid file extension .${ext} for ${kind}. Expected one of: ${allowed}`,
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

function sanitizeMetadata(
  metadata?: Record<string, any>,
): Record<string, string> | null {
  if (!metadata) return null;
  const sanitized: Record<string, string> = {};
  Object.entries(metadata).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      sanitized[key] = String(value);
    }
  });
  return Object.keys(sanitized).length > 0 ? sanitized : null;
}
