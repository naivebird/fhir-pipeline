import { parseHL7v2 } from '../hl7v2-parser';

describe('HL7v2 Parser', () => {
  describe('parseHL7v2', () => {
    it('should parse a simple HL7v2 message with PID segment', () => {
      const hl7 = `MSH|^~\\&|SendingApp|SendingFac|ReceivingApp|ReceivingFac|20240115120000||ADT^A01|MSG001|P|2.5
PID|1||P001^^^Hospital^MR||Doe^John^M||19900115|M|||123 Main St^^Boston^MA^02101||555-123-4567`;

      const result = parseHL7v2(hl7);

      expect(result.patients).toHaveLength(1);
      expect(result.patients[0]).toMatchObject({
        patientId: 'P001',
        firstName: 'John',
        lastName: 'Doe',
        birthDate: '1990-01-15',
        gender: 'male',
      });
    });

    it('should parse patient address from PID segment', () => {
      const hl7 = `MSH|^~\\&|App|Fac|App|Fac|20240115120000||ADT^A01|MSG001|P|2.5
PID|1||P001^^^Hospital^MR||Smith^Jane||19850620|F|||456 Oak Ave^^Cambridge^MA^02139||617-555-1234`;

      const result = parseHL7v2(hl7);

      expect(result.patients[0].addressLine).toBe('456 Oak Ave');
      expect(result.patients[0].city).toBe('Cambridge');
      expect(result.patients[0].state).toBe('MA');
      expect(result.patients[0].postalCode).toBe('02139');
    });

    it('should normalize gender values correctly', () => {
      const hl7Male = `MSH|^~\\&|A|B|C|D|20240115||ADT|1|P|2.5
PID|1||P001||Test^One||20000101|M`;

      const hl7Female = `MSH|^~\\&|A|B|C|D|20240115||ADT|1|P|2.5
PID|1||P002||Test^Two||20000101|F`;

      const hl7Other = `MSH|^~\\&|A|B|C|D|20240115||ADT|1|P|2.5
PID|1||P003||Test^Three||20000101|O`;

      const hl7Unknown = `MSH|^~\\&|A|B|C|D|20240115||ADT|1|P|2.5
PID|1||P004||Test^Four||20000101|X`;

      expect(parseHL7v2(hl7Male).patients[0].gender).toBe('male');
      expect(parseHL7v2(hl7Female).patients[0].gender).toBe('female');
      expect(parseHL7v2(hl7Other).patients[0].gender).toBe('other');
      expect(parseHL7v2(hl7Unknown).patients[0].gender).toBe('unknown');
    });

    it('should parse OBX observations', () => {
      const hl7 = `MSH|^~\\&|App|Fac|App|Fac|20240115120000||ORU^R01|MSG001|P|2.5
PID|1||P001||Doe^John||19900115|M
OBX|1|NM|8867-4^Heart rate^LN||72|bpm|60-100||||F|||20240115120000
OBX|2|NM|8310-5^Body temperature^LN||98.6|F|97-99||||F|||20240115120000`;

      const result = parseHL7v2(hl7);

      expect(result.observations).toHaveLength(2);
      expect(result.observations[0]).toMatchObject({
        patientId: 'P001',
        observationType: 'heart_rate',
        observationValue: 72,
        observationUnit: 'bpm',
      });
      expect(result.observations[1]).toMatchObject({
        observationType: 'body_temperature',
        observationValue: 98.6,
        observationUnit: 'F',
      });
    });

    it('should map known LOINC codes to observation types', () => {
      const hl7 = `MSH|^~\\&|App|Fac|App|Fac|20240115||ORU|1|P|2.5
PID|1||P001||Test^User||19900101|M
OBX|1|NM|8480-6^Systolic BP^LN||120|mmHg|||||F
OBX|2|NM|8462-4^Diastolic BP^LN||80|mmHg|||||F
OBX|3|NM|29463-7^Body Weight^LN||70|kg|||||F
OBX|4|NM|2708-6^O2 Sat^LN||98|%|||||F`;

      const result = parseHL7v2(hl7);

      expect(result.observations[0].observationType).toBe('blood_pressure_systolic');
      expect(result.observations[1].observationType).toBe('blood_pressure_diastolic');
      expect(result.observations[2].observationType).toBe('body_weight');
      expect(result.observations[3].observationType).toBe('oxygen_saturation');
    });

    it('should handle multiple HL7 messages in one file', () => {
      const hl7 = `MSH|^~\\&|App|Fac|App|Fac|20240115||ADT|1|P|2.5
PID|1||P001||Doe^John||19900115|M
OBX|1|NM|8867-4^HR^LN||72|bpm|||||F
MSH|^~\\&|App|Fac|App|Fac|20240116||ADT|2|P|2.5
PID|1||P002||Smith^Jane||19850620|F
OBX|1|NM|8867-4^HR^LN||68|bpm|||||F`;

      const result = parseHL7v2(hl7);

      expect(result.patients).toHaveLength(2);
      expect(result.observations).toHaveLength(2);
      expect(result.patients[0].patientId).toBe('P001');
      expect(result.patients[1].patientId).toBe('P002');
    });

    it('should deduplicate patients by patient ID', () => {
      const hl7 = `MSH|^~\\&|App|Fac|App|Fac|20240115||ORU|1|P|2.5
PID|1||P001||Doe^John||19900115|M
OBX|1|NM|8867-4^HR^LN||72|bpm|||||F
MSH|^~\\&|App|Fac|App|Fac|20240116||ORU|2|P|2.5
PID|1||P001||Doe^John||19900115|M
OBX|1|NM|8867-4^HR^LN||75|bpm|||||F`;

      const result = parseHL7v2(hl7);

      expect(result.patients).toHaveLength(1);
      expect(result.observations).toHaveLength(2);
    });

    it('should parse HL7 date format correctly', () => {
      const hl7 = `MSH|^~\\&|App|Fac|App|Fac|20240115120000||ADT|1|P|2.5
PID|1||P001||Doe^John||19900115|M`;

      const result = parseHL7v2(hl7);

      expect(result.patients[0].birthDate).toBe('1990-01-15');
    });

    it('should handle missing optional fields gracefully', () => {
      const hl7 = `MSH|^~\\&|App|Fac|App|Fac|20240115||ADT|1|P|2.5
PID|1||P001||Doe^John||19900115|M`;

      const result = parseHL7v2(hl7);

      expect(result.patients[0].phone).toBeUndefined();
      expect(result.patients[0].email).toBeUndefined();
      expect(result.patients[0].addressLine).toBeUndefined();
    });

    it('should skip messages without PID segment', () => {
      const hl7 = `MSH|^~\\&|App|Fac|App|Fac|20240115||ACK|1|P|2.5
MSA|AA|MSG001`;

      const result = parseHL7v2(hl7);

      expect(result.patients).toHaveLength(0);
      expect(result.observations).toHaveLength(0);
    });

    it('should handle string observation values', () => {
      const hl7 = `MSH|^~\\&|App|Fac|App|Fac|20240115||ORU|1|P|2.5
PID|1||P001||Doe^John||19900115|M
OBX|1|ST|BLOOD_TYPE||A+||||||F`;

      const result = parseHL7v2(hl7);

      expect(result.observations[0].observationValue).toBe('A+');
    });

    it('should use observation date from OBX when available', () => {
      const hl7 = `MSH|^~\\&|App|Fac|App|Fac|20240115120000||ORU|1|P|2.5
PID|1||P001||Doe^John||19900115|M
OBX|1|NM|8867-4^HR^LN||72|bpm|||||F|||20240120143000`;

      const result = parseHL7v2(hl7);

      expect(result.observations[0].observationDate).toBe('2024-01-20');
    });
  });
});
