import { PatientData, ObservationData, ParsedData } from '../types';

interface HL7Segment {
  type: string;
  fields: string[];
}

interface HL7Message {
  segments: HL7Segment[];
}

// LOINC code mapping for HL7v2 OBX identifiers
const OBX_CODE_MAP: Record<string, string> = {
  '8480-6': 'blood_pressure_systolic',
  '8462-4': 'blood_pressure_diastolic',
  '8867-4': 'heart_rate',
  '8310-5': 'body_temperature',
  '2339-0': 'blood_glucose',
  '29463-7': 'body_weight',
  '2708-6': 'oxygen_saturation',
};

function parseHL7Segment(line: string): HL7Segment {
  const parts = line.split('|');
  return {
    type: parts[0],
    fields: parts.slice(1),
  };
}

function parseHL7Message(content: string): HL7Message {
  const lines = content.split('\n').filter((line) => line.trim().length > 0);
  const segments = lines.map(parseHL7Segment);
  return { segments };
}

function splitMessages(content: string): string[] {
  // Split on MSH segment boundaries
  const messages: string[] = [];
  const lines = content.split('\n');
  let currentMessage: string[] = [];

  for (const line of lines) {
    if (line.startsWith('MSH|')) {
      if (currentMessage.length > 0) {
        messages.push(currentMessage.join('\n'));
      }
      currentMessage = [line];
    } else if (line.trim()) {
      currentMessage.push(line);
    }
  }

  if (currentMessage.length > 0) {
    messages.push(currentMessage.join('\n'));
  }

  return messages;
}

function normalizeGender(gender: string): 'male' | 'female' | 'other' | 'unknown' {
  const normalized = gender.toUpperCase().trim();
  if (normalized === 'M' || normalized === 'MALE') return 'male';
  if (normalized === 'F' || normalized === 'FEMALE') return 'female';
  if (normalized === 'O' || normalized === 'OTHER') return 'other';
  return 'unknown';
}

function parseHL7Date(hl7Date: string): string {
  // HL7v2 date format: YYYYMMDD or YYYYMMDDHHMMSS
  if (hl7Date.length >= 8) {
    const year = hl7Date.substring(0, 4);
    const month = hl7Date.substring(4, 6);
    const day = hl7Date.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
  return hl7Date;
}

function extractPatientFromPID(pid: HL7Segment): PatientData | null {
  // PID segment structure (0-indexed after segment type):
  // 0: Set ID
  // 1: Patient ID (external)
  // 2: Patient Identifier List (internal ID^check digit^ID type^facility)
  // 3: Alternate Patient ID
  // 4: Patient Name (family^given^middle^suffix^prefix)
  // 5: Mother's Maiden Name
  // 6: Date of Birth (YYYYMMDD)
  // 7: Sex
  // 8-10: Various address/phone fields
  // 11: Address (street^other^city^state^zip^country)

  try {
    // Extract patient ID from field 2 (Patient Identifier List)
    const idField = pid.fields[2] || '';
    const patientId = idField.split('^')[0] || `HL7-${Date.now()}`;

    // Extract name from field 4
    const nameField = pid.fields[4] || '';
    const nameParts = nameField.split('^');
    const lastName = nameParts[0] || 'Unknown';
    const firstName = nameParts[1] || 'Unknown';

    // Extract birth date from field 6
    const birthDateRaw = pid.fields[6] || '';
    const birthDate = parseHL7Date(birthDateRaw);

    // Extract gender from field 7
    const genderRaw = pid.fields[7] || '';
    const gender = normalizeGender(genderRaw);

    // Extract address from field 10 (0-indexed as 10, but may be at different index)
    // Looking for address field - usually contains street^other^city^state^zip
    const addressField = pid.fields[10] || '';
    const addressParts = addressField.split('^');

    // Extract phone from field 12
    const phoneField = pid.fields[12] || '';
    const phone = phoneField.split('^')[0] || undefined;

    return {
      patientId,
      firstName,
      lastName,
      birthDate,
      gender,
      addressLine: addressParts[0] || undefined,
      city: addressParts[2] || undefined,
      state: addressParts[3] || undefined,
      postalCode: addressParts[4] || undefined,
      phone,
    };
  } catch (error) {
    console.error('Error parsing PID segment:', error);
    return null;
  }
}

function extractObservationFromOBX(
  obx: HL7Segment,
  patientId: string,
  mshTimestamp: string
): ObservationData | null {
  // OBX segment structure (0-indexed after segment type):
  // 0: Set ID
  // 1: Value Type (NM=numeric, ST=string, etc.)
  // 2: Observation Identifier (code^text^coding system)
  // 3: Observation Sub-ID
  // 4: Observation Value
  // 5: Units (unit^text^coding system)
  // 6: Reference Range
  // 7-10: Various flags
  // 13: Observation DateTime

  try {
    // Extract observation identifier (field 2)
    const identifierField = obx.fields[2] || '';
    const identifierParts = identifierField.split('^');
    const loincCode = identifierParts[0] || '';
    const observationType = OBX_CODE_MAP[loincCode] || loincCode.replace(/[^a-zA-Z0-9]/g, '_');

    // Extract value (field 4)
    const valueRaw = obx.fields[4] || '';
    const observationValue = isNaN(Number(valueRaw)) ? valueRaw : Number(valueRaw);

    // Extract units (field 5)
    const unitsField = obx.fields[5] || '';
    const observationUnit = unitsField.split('^')[0] || '';

    // Extract observation date (field 13) or fall back to MSH timestamp
    const dateField = obx.fields[13] || mshTimestamp;
    const observationDate = parseHL7Date(dateField);

    return {
      patientId,
      observationType,
      observationValue,
      observationUnit,
      observationDate,
    };
  } catch (error) {
    console.error('Error parsing OBX segment:', error);
    return null;
  }
}

export function parseHL7v2(content: string): ParsedData {
  const messageStrings = splitMessages(content);
  const patientsMap = new Map<string, PatientData>();
  const observations: ObservationData[] = [];

  for (const msgContent of messageStrings) {
    const message = parseHL7Message(msgContent);

    // Get MSH timestamp for fallback
    const msh = message.segments.find((s) => s.type === 'MSH');
    const mshTimestamp = msh?.fields[5] || new Date().toISOString().replace(/[-:]/g, '').split('.')[0];

    // Find PID segment
    const pidSegment = message.segments.find((s) => s.type === 'PID');
    if (!pidSegment) {
      console.warn('No PID segment found in message');
      continue;
    }

    const patient = extractPatientFromPID(pidSegment);
    if (!patient) {
      console.warn('Failed to parse patient from PID segment');
      continue;
    }

    // Add patient (deduplicate by ID)
    if (!patientsMap.has(patient.patientId)) {
      patientsMap.set(patient.patientId, patient);
    }

    // Find all OBX segments
    const obxSegments = message.segments.filter((s) => s.type === 'OBX');
    for (const obx of obxSegments) {
      const observation = extractObservationFromOBX(obx, patient.patientId, mshTimestamp);
      if (observation) {
        observations.push(observation);
      }
    }
  }

  return {
    patients: Array.from(patientsMap.values()),
    observations,
  };
}
