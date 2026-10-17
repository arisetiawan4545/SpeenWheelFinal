export type UserRole = 'purchasing' | 'mcx' | 'admin' | 'kasir'; 

export interface SpeenUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export type CampaignStatus =
  | 'DRAFT'
  | 'WAITING_DESIGN'
  | 'WAITING_APPROVAL'
  | 'REVISION'
  | 'LIVE'
  | 'ENDED';

export interface SpeenCampaign {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: CampaignStatus;
  tvBackgroundUrl: string;
  mobileBannerUrl: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  revisionNote?: string;
  slots?: SpeenSlot[];
}

export interface SpeenSlot {
  id: string;
  campaignId: string;
  name: string;
  quantity: number;
  initialQuantity?: number;
  winRate: number;
  color: string;
  imageUrl: string;
  generatedCodes: string[];
  isZonk?: boolean;
}

export type TVSessionStatus =
  | 'IDLE'
  | 'CONSUMER_CONNECTED'
  | 'SPINNING'
  | 'FINISHED';

export interface SpeenTVSession {
  storeId: string;
  status: TVSessionStatus;
  currentConsumerName: string;
  selectedCampaignId: string;
  wonPrizeId: string;
  wonPrizeName?: string;
  wonVoucherCode?: string;
  consumerPhone?: string;
  receiptNumber?: string;
  lastUpdated: string;
}

export interface SpeenSpinHistory {
  id: string;
  storeId: string;
  campaignId: string;
  campaignName?: string;
  consumerName: string;
  consumerPhone?: string;
  receiptNumber?: string;
  prizeId: string;
  prizeName: string;
  voucherCode: string;
  spunAt: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}


export type ConsumerAccessStatus = 'PENDING' | 'CONNECTED' | 'SPINNING' | 'COMPLETED';

export interface SpeenConsumerAccess {
  id: string; 
  campaignId: string;
  status: ConsumerAccessStatus;
  grantedBy: string; 
  grantedAt: string;
  receiptNumber?: string; 
}

export type VoucherStatus = 'AVAILABLE' | 'CLAIMED';

export interface SpeenVoucher {
  id: string; 
  consumerPhone: string;
  campaignId: string;
  campaignName: string;
  prizeId: string;
  prizeName: string;
  voucherCode: string; 
  qrCodeData: string; 
  status: VoucherStatus;
  spunAt: string; 
  claimedAt?: string; 
  claimedBy?: string; 
}