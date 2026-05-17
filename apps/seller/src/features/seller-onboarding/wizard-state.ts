import type {
  LegalForm,
  VatStatus,
  Category,
  ServiceZoneDto,
  ProAddressDto,
} from '@tukio/contracts/dtos/identity/register-pro';

export interface IdentityStepValues {
  firstName: string;
  lastName: string;
  email: string;
  contactPhone: string;
  dateOfBirth: string;
  acceptMarketing: boolean;
}

export interface ActivityStepValues {
  companyName: string;
  siret: string;
  vatNumber?: string;
  legalForm: LegalForm;
  vatStatus: VatStatus;
  categories: Category[];
  serviceZone: ServiceZoneDto;
  address: ProAddressDto;
}

export interface DocumentsState {
  idCard: File | null;
  rib: File | null;
  kbisOrInsee: File | null;
}

export type WizardStep = 1 | 2 | 3 | 4;

export interface WizardState {
  currentStep: WizardStep;
  identity: IdentityStepValues | null;
  activity: ActivityStepValues | null;
  documents: DocumentsState;
}

export type WizardAction =
  | { type: 'SAVE_IDENTITY'; payload: IdentityStepValues }
  | { type: 'SAVE_ACTIVITY'; payload: ActivityStepValues }
  | { type: 'SET_DOCUMENT'; field: keyof DocumentsState; file: File | null }
  | { type: 'GO_BACK' }
  | { type: 'GO_TO'; step: WizardStep };

export const initialWizardState: WizardState = {
  currentStep: 1,
  identity: null,
  activity: null,
  documents: { idCard: null, rib: null, kbisOrInsee: null },
};

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SAVE_IDENTITY':
      return { ...state, identity: action.payload, currentStep: 2 };
    case 'SAVE_ACTIVITY':
      return { ...state, activity: action.payload, currentStep: 3 };
    case 'SET_DOCUMENT':
      return {
        ...state,
        documents: { ...state.documents, [action.field]: action.file },
      };
    case 'GO_BACK': {
      const prev = Math.max(1, state.currentStep - 1) as WizardStep;
      return { ...state, currentStep: prev };
    }
    case 'GO_TO':
      return { ...state, currentStep: action.step };
    default:
      return state;
  }
}
