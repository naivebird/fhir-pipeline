import { v4 as uuidv4 } from 'uuid';
import {
  PatientData,
  ObservationData,
  ParsedData,
  FHIRPatient,
  FHIRObservation,
  FHIRBundle,
  LOINC_CODES,
} from '../types';

const FHIR_IDENTIFIER_SYSTEM = 'urn:fhir-pipeline:patient-id';
const FHIR_OBSERVATION_IDENTIFIER_SYSTEM = 'urn:fhir-pipeline:observation-id';

export function mapPatientToFHIR(patient: PatientData): FHIRPatient {
  const fhirPatient: FHIRPatient = {
    resourceType: 'Patient',
    identifier: [
      {
        system: FHIR_IDENTIFIER_SYSTEM,
        value: patient.patientId,
      },
    ],
    name: [
      {
        use: 'official',
        family: patient.lastName,
        given: [patient.firstName],
      },
    ],
    gender: patient.gender,
    birthDate: patient.birthDate,
  };

  // Add telecom if available
  const telecom: FHIRPatient['telecom'] = [];
  if (patient.phone) {
    telecom.push({
      system: 'phone',
      value: patient.phone,
      use: 'home',
    });
  }
  if (patient.email) {
    telecom.push({
      system: 'email',
      value: patient.email,
    });
  }
  if (telecom.length > 0) {
    fhirPatient.telecom = telecom;
  }

  // Add address if available
  if (patient.addressLine || patient.city || patient.state || patient.postalCode) {
    fhirPatient.address = [
      {
        use: 'home',
        line: patient.addressLine ? [patient.addressLine] : undefined,
        city: patient.city,
        state: patient.state,
        postalCode: patient.postalCode,
        country: 'US',
      },
    ];
  }

  return fhirPatient;
}

// Generate a unique observation ID based on its attributes
function generateObservationId(observation: ObservationData): string {
  const parts = [
    observation.patientId,
    observation.observationType,
    observation.observationDate,
    String(observation.observationValue),
  ];
  return parts.join(':');
}

export function mapObservationToFHIR(
  observation: ObservationData,
  patientReference: string
): FHIRObservation {
  const loincInfo = LOINC_CODES[observation.observationType];
  const observationId = generateObservationId(observation);

  const fhirObservation: FHIRObservation = {
    resourceType: 'Observation',
    identifier: [
      {
        system: FHIR_OBSERVATION_IDENTIFIER_SYSTEM,
        value: observationId,
      },
    ],
    status: 'final',
    code: {
      coding: loincInfo
        ? [
            {
              system: 'http://loinc.org',
              code: loincInfo.code,
              display: loincInfo.display,
            },
          ]
        : undefined,
      text: observation.observationType.replace(/_/g, ' '),
    },
    subject: {
      reference: patientReference,
    },
    effectiveDateTime: observation.observationDate,
  };

  // Handle numeric vs string values
  if (typeof observation.observationValue === 'number') {
    fhirObservation.valueQuantity = {
      value: observation.observationValue,
      unit: observation.observationUnit,
      system: 'http://unitsofmeasure.org',
      code: observation.observationUnit,
    };
  } else {
    fhirObservation.valueString = observation.observationValue;
  }

  return fhirObservation;
}

export function createFHIRBundle(data: ParsedData): FHIRBundle {
  const bundle: FHIRBundle = {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: [],
  };

  // Track patient UUIDs for observation references
  const patientUUIDs = new Map<string, string>();

  // Add patients to bundle
  for (const patient of data.patients) {
    const uuid = uuidv4();
    patientUUIDs.set(patient.patientId, uuid);

    const fhirPatient = mapPatientToFHIR(patient);

    bundle.entry!.push({
      fullUrl: `urn:uuid:${uuid}`,
      resource: fhirPatient,
      request: {
        method: 'POST',
        url: 'Patient',
        ifNoneExist: `identifier=${FHIR_IDENTIFIER_SYSTEM}|${patient.patientId}`,
      },
    });
  }

  // Add observations to bundle
  for (const observation of data.observations) {
    const patientUUID = patientUUIDs.get(observation.patientId);
    if (!patientUUID) {
      console.warn(`No patient found for observation with patientId: ${observation.patientId}`);
      continue;
    }

    const fhirObservation = mapObservationToFHIR(observation, `urn:uuid:${patientUUID}`);
    const observationId = generateObservationId(observation);

    bundle.entry!.push({
      fullUrl: `urn:uuid:${uuidv4()}`,
      resource: fhirObservation,
      request: {
        method: 'POST',
        url: 'Observation',
        ifNoneExist: `identifier=${FHIR_OBSERVATION_IDENTIFIER_SYSTEM}|${observationId}`,
      },
    });
  }

  return bundle;
}
