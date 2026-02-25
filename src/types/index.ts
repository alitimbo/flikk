export type UserRole = "merchant" | "customer";
export type UserStatus = "active" | "inactive";
export type AppLanguage = "fr" | "en";
export type AiVideoFormat = "16:9" | "9:16";
export type AiVideoReceptionMethod = "whatsapp" | "email";

export interface UserMerchantInfo {
  businessName: string;
  taxId: string;
  address: string;
  businessPhone: string;
  logoUrl: string;
  withdrawalMethod?: WithdrawalMethod;
  withdrawalNumber?: string;
}

export type WithdrawalMethod =
  | "nita"
  | "amana"
  | "wave"
  | "airtel"
  | "zamani"
  | "moov"
  | "orangeMali"
  | "orangeBurkina";

export interface UserProfile {
  uid: string;
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role: UserRole;
  status: UserStatus;
  isMerchant: boolean; // Kept for backward compatibility, but synced with role
  freeUsageCount?: number;
  followerCount?: number;
  notificationLanguage?: AppLanguage;
  merchantInfo?: UserMerchantInfo;
  createdAt?: any;
  updatedAt?: any;
}

export interface AiVideoOrder {
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  expectedContent: string;
  format: AiVideoFormat;
  productImage1Url: string;
  productImage2Url: string;
  receptionMethod: AiVideoReceptionMethod;
  receptionContact: string;
  basePrice: number;
  finalPrice: number;
  freeUsageApplied: boolean;
  status: "pending" | "processing" | "done" | "cancelled";
  createdAt?: any;
  updatedAt?: any;
}

export interface NotificationDevice {
  uid: string;
  deviceId: string;
  fcmToken?: string | null;
  language?: AppLanguage;
  platform?: "ios" | "android" | "web";
  createdAt?: any;
  updatedAt?: any;
  lastSeenAt?: any;
}

export interface Publication {
  id?: string;
  userId: string;
  productName: string;
  title: string;
  price: number;
  hashtags: string[];
  imageUrl: string;
  videoUrl: string; // Original video URL
  hlsUrl?: string; // Transcoded master.m3u8 URL
  searchTokens?: string[];
  merchantName?: string;
  merchantLogoUrl?: string;
  status: "pending" | "processing" | "ready" | "error" | "deleted";

  // Stats
  orderCount: number;
  commentCount: number;
  likeCount: number;
  reviewCount: number;
  viewCount: number;

  createdAt?: any;
  updatedAt?: any;
}

export type CommentSort = "top" | "new";

export interface Comment {
  id?: string;
  publicationId: string;
  userId: string;
  text: string;
  likeCount: number;
  replyCount: number;
  parentId?: string | null;
  authorName?: string;
  authorAvatarUrl?: string;
  authorIsMerchant?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export type PaymentStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "declined"
  | "insufficient_fund";

export interface PaymentRequest {
  publicationId: string;
  msisdn: string;
  customerName?: string;
  country?: string;
  currency?: string;
}

export interface PaymentResponse {
  reference: string;
  status: PaymentStatus;
  orderNumber?: string;
}

export interface PaymentStatusResponse {
  external_reference?: string;
  reference: string;
  status: PaymentStatus;
  msisdn?: string;
}

export interface OtpStartRequest {
  channel?: OtpChannel;
  phoneNumber?: string;
  email?: string;
}

export interface OtpStartResponse {
  challengeId: string;
  expiresInSec: number;
  resendAfterSec: number;
  channel?: OtpChannel;
  maskedTarget?: string;
}

export interface OtpVerifyRequest {
  challengeId: string;
  code: string;
}

export interface OtpVerifyResponse {
  customToken: string;
  uid: string;
  isNewUser: boolean;
  channel?: OtpChannel;
}

export type OtpChannel = "sms" | "email";

export interface Order {
  orderId: string;
  orderNumber?: string | null;
  paymentReference: string;
  paymentStatus: "paid" | "failed" | "pending";
  externalReference?: string | null;
  publicationId?: string | null;
  productName?: string | null;
  productImageUrl?: string | null;
  amount?: number | null;
  currency?: string | null;
  country?: string | null;
  msisdn?: string | null;
  customerName?: string | null;
  customerId?: string | null;
  merchantId?: string | null;
  merchantName?: string | null;
  merchantLogoUrl?: string | null;
  status?: "paid" | "failed" | "pending" | "delivered" | "shipped" | "shipping";
  createdAt?: any;
  updatedAt?: any;
}

export interface CartItem {
  publicationId: string;
  merchantId: string;
  merchantName?: string | null;
  merchantLogoUrl?: string | null;
  productName: string;
  imageUrl: string;
  priceAtAdd: number;
  currency?: string;
  quantity: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface CartResolvedItem extends CartItem {
  livePrice: number;
  liveProductName: string;
  liveImageUrl: string;
  isPriceChanged: boolean;
  isUnavailable: boolean;
}
