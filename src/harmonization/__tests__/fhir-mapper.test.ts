import { mapPatientToFHIR, mapObservationToFHIR, createFHIRBundle } from '../fhir-mapper';
import { PatientData, ObservationData, ParsedData } from '../../types';

describe('FHIR Mapper', () => {
  describe('mapPatientToFHIR', () => {
    it('should map basic patient data to FHIR Patient resource', () => {
      const patient: PatientData = {
        patientId: 'P001',
        firstName: 'John',
        lastName: 'Doe',
        birthDate: '1990-01-15',
        gender: 'male',
      };

      const result = mapPatientToFHIR(patient);

      expect(result.resourceType).toBe('Patient');
      expect(result.identifier).toEqual([
        {
          system: 'urn:fhir-pipeline:patient-id',
          value: 'P001',
        },
      ]);
      expect(result.name).toEqual([
        {
          use: 'official',
          family: 'Doe',
          given: ['John'],
        },
      ]);
      expect(result.gender).toBe('male');
      expect(result.birthDate).toBe('1990-01-15');
    });

    it('should include phone in telecom when provided', () => {
      const patient: PatientData = {
        patientId: 'P001',
        firstName: 'John',
        lastName: 'Doe',
        birthDate: '1990-01-15',
        gender: 'male',
        phone: '555-123-4567',
      };

      const result = mapPatientToFHIR(patient);

      expect(result.telecom).toContainEqual({
        system: 'phone',
        value: '555-123-4567',
        use: 'home',
      });
    });

    it('should include email in telecom when provided', () => {
      const patient: PatientData = {
        patientId: 'P001',
        firstName: 'John',
        lastName: 'Doe',
        birthDate: '1990-01-15',
        gender: 'male',
        email: 'john@example.com',
      };

      const result = mapPatientToFHIR(patient);

      expect(result.telecom).toContainEqual({
        system: 'email',
        value: 'john@example.com',
      });
    });

    it('should include both phone and email when provided', () => {
      const patient: PatientData = {
        patientId: 'P001',
        firstName: 'John',
        lastName: 'Doe',
        birthDate: '1990-01-15',
        gender: 'male',
        phone: '555-123-4567',
        email: 'john@example.com',
      };

      const result = mapPatientToFHIR(patient);

      expect(result.telecom).toHaveLength(2);
    });

    it('should not include telecom when phone and email are not provided', () => {
      const patient: PatientData = {
        patientId: 'P001',
        firstName: 'John',
        lastName: 'Doe',
        birthDate: '1990-01-15',
        gender: 'male',
      };

      const result = mapPatientToFHIR(patient);

      expect(result.telecom).toBeUndefined();
    });

    it('should include address when provided', () => {
      const patient: PatientData = {
        patientId: 'P001',
        firstName: 'John',
        lastName: 'Doe',
        birthDate: '1990-01-15',
        gender: 'male',
        addressLine: '123 Main St',
        city: 'Boston',
        state: 'MA',
        postalCode: '02101',
      };

      const result = mapPatientToFHIR(patient);

      expect(result.address).toEqual([
        {
          use: 'home',
          line: ['123 Main St'],
          city: 'Boston',
          state: 'MA',
          postalCode: '02101',
          country: 'US',
        },
      ]);
    });

    it('should handle partial address data', () => {
      const patient: PatientData = {
        patientId: 'P001',
        firstName: 'John',
        lastName: 'Doe',
        birthDate: '1990-01-15',
        gender: 'male',
        city: 'Boston',
      };

      const result = mapPatientToFHIR(patient);

      expect(result.address).toBeDefined();
      expect(result.address![0].city).toBe('Boston');
      expect(result.address![0].line).toBeUndefined();
    });

    it('should handle all gender values', () => {
      const genders: Array<'male' | 'female' | 'other' | 'unknown'> = ['male', 'female', 'other', 'unknown'];

      genders.forEach((gender) => {
        const patient: PatientData = {
          patientId: 'P001',
          firstName: 'Test',
          lastName: 'Patient',
          birthDate: '2000-01-01',
          gender,
        };

        const result = mapPatientToFHIR(patient);
        expect(result.gender).toBe(gender);
      });
    });
  });

  describe('mapObservationToFHIR', () => {
    it('should map numeric observation to FHIR Observation with valueQuantity', () => {
      const observation: ObservationData = {
        patientId: 'P001',
        observationType: 'heart_rate',
        observationValue: 72,
        observationUnit: 'bpm',
        observationDate: '2024-01-15',
      };

      const result = mapObservationToFHIR(observation, 'urn:uuid:patient-uuid');

      expect(result.resourceType).toBe('Observation');
      expect(result.status).toBe('final');
      expect(result.subject).toEqual({ reference: 'urn:uuid:patient-uuid' });
      expect(result.effectiveDateTime).toBe('2024-01-15');
      expect(result.valueQuantity).toEqual({
        value: 72,
        unit: 'bpm',
        system: 'http://unitsofmeasure.org',
        code: 'bpm',
      });
    });

    it('should map string observation to FHIR Observation with valueString', () => {
      const observation: ObservationData = {
        patientId: 'P001',
        observationType: 'blood_type',
        observationValue: 'A+',
        observationUnit: '',
        observationDate: '2024-01-15',
      };

      const result = mapObservationToFHIR(observation, 'urn:uuid:patient-uuid');

      expect(result.valueString).toBe('A+');
      expect(result.valueQuantity).toBeUndefined();
    });

    it('should include LOINC coding for known observation types', () => {
      const observation: ObservationData = {
        patientId: 'P001',
        observationType: 'heart_rate',
        observationValue: 72,
        observationUnit: 'bpm',
        observationDate: '2024-01-15',
      };

      const result = mapObservationToFHIR(observation, 'urn:uuid:patient-uuid');

      expect(result.code.coding).toEqual([
        {
          system: 'http://loinc.org',
          code: '8867-4',
          display: 'Heart rate',
        },
      ]);
    });

    it('should handle unknown observation types without LOINC coding', () => {
      const observation: ObservationData = {
        patientId: 'P001',
        observationType: 'custom_measurement',
        observationValue: 42,
        observationUnit: 'units',
        observationDate: '2024-01-15',
      };

      const result = mapObservationToFHIR(observation, 'urn:uuid:patient-uuid');

      expect(result.code.coding).toBeUndefined();
      expect(result.code.text).toBe('custom measurement');
    });

    it('should replace underscores with spaces in observation type text', () => {
      const observation: ObservationData = {
        patientId: 'P001',
        observationType: 'blood_pressure_systolic',
        observationValue: 120,
        observationUnit: 'mmHg',
        observationDate: '2024-01-15',
      };

      const result = mapObservationToFHIR(observation, 'urn:uuid:patient-uuid');

      expect(result.code.text).toBe('blood pressure systolic');
    });
  });

  describe('createFHIRBundle', () => {
    it('should create a transaction bundle with patients and observations', () => {
      const data: ParsedData = {
        patients: [
          {
            patientId: 'P001',
            firstName: 'John',
            lastName: 'Doe',
            birthDate: '1990-01-15',
            gender: 'male',
          },
        ],
        observations: [
          {
            patientId: 'P001',
            observationType: 'heart_rate',
            observationValue: 72,
            observationUnit: 'bpm',
            observationDate: '2024-01-15',
          },
        ],
      };

      const result = createFHIRBundle(data);

      expect(result.resourceType).toBe('Bundle');
      expect(result.type).toBe('transaction');
      expect(result.entry).toHaveLength(2);
    });

    it('should create entries with POST request for patients', () => {
      const data: ParsedData = {
        patients: [
          {
            patientId: 'P001',
            firstName: 'John',
            lastName: 'Doe',
            birthDate: '1990-01-15',
            gender: 'male',
          },
        ],
        observations: [],
      };

      const result = createFHIRBundle(data);

      const patientEntry = result.entry![0];
      expect(patientEntry.request).toEqual({
        method: 'POST',
        url: 'Patient',
        ifNoneExist: 'identifier=urn:fhir-pipeline:patient-id|P001',
      });
      expect(patientEntry.fullUrl).toMatch(/^urn:uuid:/);
      expect(patientEntry.resource!.resourceType).toBe('Patient');
    });

    it('should create entries with POST request for observations', () => {
      const data: ParsedData = {
        patients: [
          {
            patientId: 'P001',
            firstName: 'John',
            lastName: 'Doe',
            birthDate: '1990-01-15',
            gender: 'male',
          },
        ],
        observations: [
          {
            patientId: 'P001',
            observationType: 'heart_rate',
            observationValue: 72,
            observationUnit: 'bpm',
            observationDate: '2024-01-15',
          },
        ],
      };

      const result = createFHIRBundle(data);

      const observationEntry = result.entry![1];
      expect(observationEntry.request).toEqual({
        method: 'POST',
        url: 'Observation',
        ifNoneExist: 'identifier=urn:fhir-pipeline:observation-id|P001:heart_rate:2024-01-15:72',
      });
      expect(observationEntry.fullUrl).toMatch(/^urn:uuid:/);
      expect(observationEntry.resource!.resourceType).toBe('Observation');
    });

    it('should link observations to patients via urn:uuid reference', () => {
      const data: ParsedData = {
        patients: [
          {
            patientId: 'P001',
            firstName: 'John',
            lastName: 'Doe',
            birthDate: '1990-01-15',
            gender: 'male',
          },
        ],
        observations: [
          {
            patientId: 'P001',
            observationType: 'heart_rate',
            observationValue: 72,
            observationUnit: 'bpm',
            observationDate: '2024-01-15',
          },
        ],
      };

      const result = createFHIRBundle(data);

      const patientEntry = result.entry![0];
      const observationEntry = result.entry![1];
      const observation = observationEntry.resource as any;

      expect(observation.subject.reference).toBe(patientEntry.fullUrl);
    });

    it('should handle multiple patients and observations', () => {
      const data: ParsedData = {
        patients: [
          { patientId: 'P001', firstName: 'John', lastName: 'Doe', birthDate: '1990-01-15', gender: 'male' },
          { patientId: 'P002', firstName: 'Jane', lastName: 'Smith', birthDate: '1985-06-20', gender: 'female' },
        ],
        observations: [
          { patientId: 'P001', observationType: 'heart_rate', observationValue: 72, observationUnit: 'bpm', observationDate: '2024-01-15' },
          { patientId: 'P001', observationType: 'body_temperature', observationValue: 98.6, observationUnit: 'F', observationDate: '2024-01-15' },
          { patientId: 'P002', observationType: 'heart_rate', observationValue: 68, observationUnit: 'bpm', observationDate: '2024-01-15' },
        ],
      };

      const result = createFHIRBundle(data);

      expect(result.entry).toHaveLength(5); // 2 patients + 3 observations
    });

    it('should skip observations without matching patient', () => {
      const data: ParsedData = {
        patients: [
          { patientId: 'P001', firstName: 'John', lastName: 'Doe', birthDate: '1990-01-15', gender: 'male' },
        ],
        observations: [
          { patientId: 'P001', observationType: 'heart_rate', observationValue: 72, observationUnit: 'bpm', observationDate: '2024-01-15' },
          { patientId: 'P999', observationType: 'heart_rate', observationValue: 80, observationUnit: 'bpm', observationDate: '2024-01-15' }, // No matching patient
        ],
      };

      const result = createFHIRBundle(data);

      expect(result.entry).toHaveLength(2); // 1 patient + 1 observation (P999 observation skipped)
    });

    it('should create an empty bundle when no data provided', () => {
      const data: ParsedData = {
        patients: [],
        observations: [],
      };

      const result = createFHIRBundle(data);

      expect(result.resourceType).toBe('Bundle');
      expect(result.type).toBe('transaction');
      expect(result.entry).toHaveLength(0);
    });

    it('should include ifNoneExist for idempotent patient creation', () => {
      const data: ParsedData = {
        patients: [
          { patientId: 'P001', firstName: 'John', lastName: 'Doe', birthDate: '1990-01-15', gender: 'male' },
        ],
        observations: [],
      };

      const result = createFHIRBundle(data);

      const patientEntry = result.entry![0];
      expect(patientEntry.request?.ifNoneExist).toBe('identifier=urn:fhir-pipeline:patient-id|P001');
    });

    it('should include ifNoneExist for idempotent observation creation', () => {
      const data: ParsedData = {
        patients: [
          { patientId: 'P001', firstName: 'John', lastName: 'Doe', birthDate: '1990-01-15', gender: 'male' },
        ],
        observations: [
          { patientId: 'P001', observationType: 'heart_rate', observationValue: 72, observationUnit: 'bpm', observationDate: '2024-01-15' },
        ],
      };

      const result = createFHIRBundle(data);

      const observationEntry = result.entry![1];
      expect(observationEntry.request?.ifNoneExist).toContain('identifier=urn:fhir-pipeline:observation-id|');
      expect(observationEntry.request?.ifNoneExist).toContain('P001:heart_rate:2024-01-15:72');
    });

    it('should add identifier to observation resources', () => {
      const data: ParsedData = {
        patients: [
          { patientId: 'P001', firstName: 'John', lastName: 'Doe', birthDate: '1990-01-15', gender: 'male' },
        ],
        observations: [
          { patientId: 'P001', observationType: 'heart_rate', observationValue: 72, observationUnit: 'bpm', observationDate: '2024-01-15' },
        ],
      };

      const result = createFHIRBundle(data);

      const observation = result.entry![1].resource as any;
      expect(observation.identifier).toBeDefined();
      expect(observation.identifier[0].system).toBe('urn:fhir-pipeline:observation-id');
      expect(observation.identifier[0].value).toBe('P001:heart_rate:2024-01-15:72');
    });
  });
});
