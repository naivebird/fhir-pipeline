import { parse } from 'csv-parse/sync';
import { PatientData, ObservationData, ParsedData } from '../types';

interface CSVRow {
  patient_id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  gender: string;
  address_line?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  phone?: string;
  email?: string;
  observation_type?: string;
  observation_value?: string;
  observation_unit?: string;
  observation_date?: string;
}

function normalizeGender(gender: string): 'male' | 'female' | 'other' | 'unknown' {
  const normalized = gender.toLowerCase().trim();
  if (normalized === 'male' || normalized === 'm') return 'male';
  if (normalized === 'female' || normalized === 'f') return 'female';
  if (normalized === 'other' || normalized === 'o') return 'other';
  return 'unknown';
}

export function parseCSV(content: string): ParsedData {
  const records: CSVRow[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const patientsMap = new Map<string, PatientData>();
  const observations: ObservationData[] = [];

  for (const row of records) {
    // Extract patient data (deduplicate by patient_id)
    if (!patientsMap.has(row.patient_id)) {
      patientsMap.set(row.patient_id, {
        patientId: row.patient_id,
        firstName: row.first_name,
        lastName: row.last_name,
        birthDate: row.birth_date,
        gender: normalizeGender(row.gender),
        addressLine: row.address_line,
        city: row.city,
        state: row.state,
        postalCode: row.postal_code,
        phone: row.phone,
        email: row.email,
      });
    }

    // Extract observation data if present
    if (row.observation_type && row.observation_value) {
      observations.push({
        patientId: row.patient_id,
        observationType: row.observation_type,
        observationValue: isNaN(Number(row.observation_value))
          ? row.observation_value
          : Number(row.observation_value),
        observationUnit: row.observation_unit || '',
        observationDate: row.observation_date || new Date().toISOString().split('T')[0],
      });
    }
  }

  return {
    patients: Array.from(patientsMap.values()),
    observations,
  };
}
