// Intermediate data format (parsed from CSV or HL7v2)
export interface PatientData {
  patientId: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: 'male' | 'female' | 'other' | 'unknown';
  addressLine?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
}

export interface ObservationData {
  patientId: string;
  observationType: string;
  observationValue: number | string;
  observationUnit: string;
  observationDate: string;
}

export interface ParsedData {
  patients: PatientData[];
  observations: ObservationData[];
}

// FHIR R4 Resource Types (simplified)
export interface FHIRResource {
  resourceType: string;
  id?: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
  };
}

export interface FHIRPatient extends FHIRResource {
  resourceType: 'Patient';
  identifier?: Array<{
    system?: string;
    value: string;
  }>;
  name?: Array<{
    use?: string;
    family?: string;
    given?: string[];
  }>;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  telecom?: Array<{
    system?: 'phone' | 'email';
    value?: string;
    use?: string;
  }>;
  address?: Array<{
    use?: string;
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>;
}

export interface FHIRObservation extends FHIRResource {
  resourceType: 'Observation';
  identifier?: Array<{
    system?: string;
    value: string;
  }>;
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
  code: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  subject?: {
    reference?: string;
  };
  effectiveDateTime?: string;
  valueQuantity?: {
    value?: number;
    unit?: string;
    system?: string;
    code?: string;
  };
  valueString?: string;
}

export interface FHIRBundle extends FHIRResource {
  resourceType: 'Bundle';
  type: 'batch' | 'transaction' | 'collection';
  entry?: Array<{
    fullUrl?: string;
    resource?: FHIRResource;
    request?: {
      method: 'POST' | 'PUT' | 'DELETE' | 'GET';
      url: string;
      ifNoneExist?: string;
    };
  }>;
}

export interface FHIRBundleResponse extends FHIRResource {
  resourceType: 'Bundle';
  type: 'batch-response' | 'transaction-response';
  entry?: Array<{
    response?: {
      status: string;
      location?: string;
      etag?: string;
      lastModified?: string;
    };
    resource?: FHIRResource;
  }>;
}

// GCS Event from Eventarc
export interface GCSEvent {
  bucket: string;
  name: string;
  metageneration: string;
  timeCreated: string;
  updated: string;
  contentType?: string;
  size?: string;
}

export interface CloudEventData {
  message?: {
    data?: string;
  };
  subscription?: string;
}

// LOINC codes mapping for observations
export const LOINC_CODES: Record<string, { code: string; display: string }> = {
  blood_pressure_systolic: { code: '8480-6', display: 'Systolic blood pressure' },
  blood_pressure_diastolic: { code: '8462-4', display: 'Diastolic blood pressure' },
  heart_rate: { code: '8867-4', display: 'Heart rate' },
  body_temperature: { code: '8310-5', display: 'Body temperature' },
  blood_glucose: { code: '2339-0', display: 'Glucose [Mass/volume] in Blood' },
  body_weight: { code: '29463-7', display: 'Body weight' },
  oxygen_saturation: { code: '2708-6', display: 'Oxygen saturation in Arterial blood' },
};
