
export interface SpeenUser {
  id: string; 
  email: string;
  name: string;
  role: 'purchasing' | 'mcx' | 'admin';
}


export type CampaignStatus = 'DRAFT' | 'WAITING_DESIGN' | 'WAITING_APPROVAL' | 'REVISION' | 'LIVE' | 'ENDED';
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
}


export interface SpeenSlot {
  id: string;
  campaignId: string; 
  name: string;
  quantity: number;
  winRate: number; 
  color: string; 
  imageUrl: string; 
  generatedCodes: string[]; 
}


export type TVSessionStatus = 'IDLE' | 'CONSUMER_CONNECTED' | 'SPINNING' | 'FINISHED';
export interface SpeenTVSession {
  storeId: string; 
  status: TVSessionStatus;
  currentConsumerName: string;
  selectedCampaignId: string;
  wonPrizeId: string;
  lastUpdated: string;
}