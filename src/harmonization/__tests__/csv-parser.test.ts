import { parseCSV } from '../csv-parser';

describe('CSV Parser', () => {
  describe('parseCSV', () => {
    it('should parse a simple CSV with patient data', () => {
      const csv = `patient_id,first_name,last_name,birth_date,gender
P001,John,Doe,1990-01-15,male
P002,Jane,Smith,1985-06-20,female`;

      const result = parseCSV(csv);

      expect(result.patients).toHaveLength(2);
      expect(result.patients[0]).toEqual({
        patientId: 'P001',
        firstName: 'John',
        lastName: 'Doe',
        birthDate: '1990-01-15',
        gender: 'male',
        addressLine: undefined,
        city: undefined,
        state: undefined,
        postalCode: undefined,
        phone: undefined,
        email: undefined,
      });
      expect(result.patients[1].gender).toBe('female');
    });

    it('should parse patient with full address and contact info', () => {
      const csv = `patient_id,first_name,last_name,birth_date,gender,address_line,city,state,postal_code,phone,email
P001,John,Doe,1990-01-15,M,123 Main St,Boston,MA,02101,555-123-4567,john@example.com`;

      const result = parseCSV(csv);

      expect(result.patients[0]).toEqual({
        patientId: 'P001',
        firstName: 'John',
        lastName: 'Doe',
        birthDate: '1990-01-15',
        gender: 'male',
        addressLine: '123 Main St',
        city: 'Boston',
        state: 'MA',
        postalCode: '02101',
        phone: '555-123-4567',
        email: 'john@example.com',
      });
    });

    it('should normalize gender values correctly', () => {
      const csv = `patient_id,first_name,last_name,birth_date,gender
P001,Test,One,2000-01-01,M
P002,Test,Two,2000-01-01,F
P003,Test,Three,2000-01-01,male
P004,Test,Four,2000-01-01,female
P005,Test,Five,2000-01-01,OTHER
P006,Test,Six,2000-01-01,invalid`;

      const result = parseCSV(csv);

      expect(result.patients[0].gender).toBe('male');
      expect(result.patients[1].gender).toBe('female');
      expect(result.patients[2].gender).toBe('male');
      expect(result.patients[3].gender).toBe('female');
      expect(result.patients[4].gender).toBe('other');
      expect(result.patients[5].gender).toBe('unknown');
    });

    it('should parse observations from CSV rows', () => {
      const csv = `patient_id,first_name,last_name,birth_date,gender,observation_type,observation_value,observation_unit,observation_date
P001,John,Doe,1990-01-15,M,heart_rate,72,bpm,2024-01-15
P001,John,Doe,1990-01-15,M,body_temperature,98.6,F,2024-01-15`;

      const result = parseCSV(csv);

      expect(result.patients).toHaveLength(1); // Deduplicated
      expect(result.observations).toHaveLength(2);
      expect(result.observations[0]).toEqual({
        patientId: 'P001',
        observationType: 'heart_rate',
        observationValue: 72,
        observationUnit: 'bpm',
        observationDate: '2024-01-15',
      });
      expect(result.observations[1].observationValue).toBe(98.6);
    });

    it('should handle string observation values', () => {
      const csv = `patient_id,first_name,last_name,birth_date,gender,observation_type,observation_value,observation_unit,observation_date
P001,John,Doe,1990-01-15,M,blood_type,A+,,2024-01-15`;

      const result = parseCSV(csv);

      expect(result.observations[0].observationValue).toBe('A+');
      expect(result.observations[0].observationUnit).toBe('');
    });

    it('should deduplicate patients by patient_id', () => {
      const csv = `patient_id,first_name,last_name,birth_date,gender,observation_type,observation_value,observation_unit,observation_date
P001,John,Doe,1990-01-15,M,heart_rate,72,bpm,2024-01-15
P001,John,Doe,1990-01-15,M,heart_rate,75,bpm,2024-01-16
P001,John,Doe,1990-01-15,M,heart_rate,70,bpm,2024-01-17`;

      const result = parseCSV(csv);

      expect(result.patients).toHaveLength(1);
      expect(result.observations).toHaveLength(3);
    });

    it('should handle empty CSV', () => {
      const csv = `patient_id,first_name,last_name,birth_date,gender`;

      const result = parseCSV(csv);

      expect(result.patients).toHaveLength(0);
      expect(result.observations).toHaveLength(0);
    });

    it('should skip rows without observation data', () => {
      const csv = `patient_id,first_name,last_name,birth_date,gender,observation_type,observation_value
P001,John,Doe,1990-01-15,M,,
P002,Jane,Smith,1985-06-20,F,heart_rate,72`;

      const result = parseCSV(csv);

      expect(result.patients).toHaveLength(2);
      expect(result.observations).toHaveLength(1);
      expect(result.observations[0].patientId).toBe('P002');
    });

    it('should trim whitespace from values', () => {
      const csv = `patient_id,first_name,last_name,birth_date,gender
  P001  ,  John  ,  Doe  ,  1990-01-15  ,  male  `;

      const result = parseCSV(csv);

      expect(result.patients[0].patientId).toBe('P001');
      expect(result.patients[0].firstName).toBe('John');
      expect(result.patients[0].lastName).toBe('Doe');
    });
  });
});
