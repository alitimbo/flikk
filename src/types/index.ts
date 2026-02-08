export type UserRole = "merchant" | "customer";
export type UserStatus = "active" | "inactive";

export interface UserMerchantInfo {
  businessName: string;
  taxId: string;
  address: string;
  businessPhone: string;
  logoUrl: string;
}

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
  status: "pending" | "processing" | "ready" | "error";

  // Stats
  orderCount: number;
  commentCount: number;
  likeCount: number;
  reviewCount: number;
  viewCount: number;

  createdAt?: any;
  updatedAt?: any;
}
