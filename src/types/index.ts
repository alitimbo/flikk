export type UserRole = "merchant" | "customer";
export type UserStatus = "active" | "inactive";

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
  | "moov";

export interface UserProfile {
  uid: string;
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role: UserRole;
  status: UserStatus;
  isMerchant: boolean; // Kept for backward compatibility, but synced with role
  merchantInfo?: UserMerchantInfo;
  createdAt?: any;
  updatedAt?: any;
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
}

export interface PaymentStatusResponse {
  external_reference?: string;
  reference: string;
  status: PaymentStatus;
  msisdn?: string;
}

export interface Order {
  orderId: string;
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
  status?: "paid" | "failed" | "pending";
  createdAt?: any;
  updatedAt?: any;
}
