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
