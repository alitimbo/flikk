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
