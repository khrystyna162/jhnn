export type WorkplaceStatus = 'ACTIVE' | 'PAUSED' | 'INACTIVE';

export interface PublicWorkplace {
  id: string;
  number: string;
  serviceName?: string;
  currentTicketNumber?: string;
  operatorName?: string;
  status: WorkplaceStatus;
}

export interface PublicTicket {
  number: string;
  serviceName?: string;
  workplaceNumber?: string;
  status: string;
  calledAt?: string;
}

export interface PublicDisplayData {
  branchId: string;
  branchName: string;
  updatedAt: string;
  displaySettings: {
    ttsEnabled: boolean;
    ttsVoice?: string;
    ttsRate: number;
    ttsVolume: number;
  };
  workplaces: PublicWorkplace[];
  activeTickets: PublicTicket[];
  waitingTickets: PublicTicket[];
  completedTicketNumbers: string[];
}
