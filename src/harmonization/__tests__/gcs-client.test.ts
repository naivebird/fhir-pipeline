import { GCSClient } from '../gcs-client';

// Mock the @google-cloud/storage module
jest.mock('@google-cloud/storage', () => {
  const mockDownload = jest.fn();
  const mockMove = jest.fn();
  const mockCopy = jest.fn();

  return {
    Storage: jest.fn().mockImplementation(() => ({
      bucket: jest.fn().mockImplementation(() => ({
        file: jest.fn().mockImplementation(() => ({
          download: mockDownload,
          move: mockMove,
          copy: mockCopy,
        })),
      })),
    })),
    __mockDownload: mockDownload,
    __mockMove: mockMove,
    __mockCopy: mockCopy,
  };
});

describe('GCSClient', () => {
  let client: GCSClient;

  beforeEach(() => {
    client = new GCSClient();
    jest.clearAllMocks();
  });

  describe('getFileType', () => {
    it('should return "csv" for files in csv-ehr/ prefix', () => {
      expect(client.getFileType('csv-ehr/batch_001/patients.csv')).toBe('csv');
      expect(client.getFileType('csv-ehr/data.csv')).toBe('csv');
    });

    it('should return "hl7v2" for files in hl7v2/ prefix', () => {
      expect(client.getFileType('hl7v2/messages.hl7')).toBe('hl7v2');
      expect(client.getFileType('hl7v2/batch_001/data.hl7')).toBe('hl7v2');
    });

    it('should return "synthea" for files in synthea/ prefix', () => {
      expect(client.getFileType('synthea/John_Doe.json')).toBe('synthea');
      expect(client.getFileType('synthea/bundle_001/patient.json')).toBe('synthea');
    });

    it('should return "unknown" for files in unrecognized prefixes', () => {
      expect(client.getFileType('other/data.csv')).toBe('unknown');
      expect(client.getFileType('random.txt')).toBe('unknown');
      expect(client.getFileType('processed/data.csv')).toBe('unknown');
    });

    it('should be case-sensitive for prefix matching', () => {
      expect(client.getFileType('CSV-EHR/data.csv')).toBe('unknown');
      expect(client.getFileType('HL7V2/data.hl7')).toBe('unknown');
      expect(client.getFileType('Synthea/data.json')).toBe('unknown');
    });
  });

  describe('shouldProcess', () => {
    it('should return true for processable files in recognized prefixes', () => {
      expect(client.shouldProcess('csv-ehr/patients.csv')).toBe(true);
      expect(client.shouldProcess('hl7v2/messages.hl7')).toBe(true);
      expect(client.shouldProcess('synthea/patient.json')).toBe(true);
    });

    it('should return false for .gitkeep files', () => {
      expect(client.shouldProcess('csv-ehr/.gitkeep')).toBe(false);
      expect(client.shouldProcess('hl7v2/.gitkeep')).toBe(false);
      expect(client.shouldProcess('synthea/.gitkeep')).toBe(false);
    });

    it('should return false for files in processed/ prefix', () => {
      expect(client.shouldProcess('processed/csv-ehr/patients.csv')).toBe(false);
      expect(client.shouldProcess('processed/data.csv')).toBe(false);
    });

    it('should return false for files in unrecognized prefixes', () => {
      expect(client.shouldProcess('other/data.csv')).toBe(false);
      expect(client.shouldProcess('random.txt')).toBe(false);
      expect(client.shouldProcess('temp/file.json')).toBe(false);
    });

    it('should handle nested directories correctly', () => {
      expect(client.shouldProcess('csv-ehr/batch_001/patients.csv')).toBe(true);
      expect(client.shouldProcess('csv-ehr/2024/01/patients.csv')).toBe(true);
    });

    it('should not process files that end with .gitkeep regardless of path', () => {
      expect(client.shouldProcess('any/path/.gitkeep')).toBe(false);
      expect(client.shouldProcess('csv-ehr/subfolder/.gitkeep')).toBe(false);
    });
  });

  describe('downloadFile', () => {
    it('should download and return file contents as string', async () => {
      const { __mockDownload } = require('@google-cloud/storage');
      const mockContent = Buffer.from('test file content');
      __mockDownload.mockResolvedValue([mockContent]);

      const result = await client.downloadFile('test-bucket', 'test-file.csv');

      expect(result).toBe('test file content');
    });

    it('should handle UTF-8 content correctly', async () => {
      const { __mockDownload } = require('@google-cloud/storage');
      const mockContent = Buffer.from('Hello, 世界! 🌍');
      __mockDownload.mockResolvedValue([mockContent]);

      const result = await client.downloadFile('test-bucket', 'unicode.txt');

      expect(result).toBe('Hello, 世界! 🌍');
    });
  });

  describe('moveFile', () => {
    it('should move file to destination', async () => {
      const { __mockMove } = require('@google-cloud/storage');
      __mockMove.mockResolvedValue(undefined);

      await client.moveFile('test-bucket', 'source.csv', 'destination.csv');

      expect(__mockMove).toHaveBeenCalledWith('destination.csv');
    });
  });

  describe('copyFile', () => {
    it('should copy file to destination', async () => {
      const { __mockCopy } = require('@google-cloud/storage');
      __mockCopy.mockResolvedValue(undefined);

      await client.copyFile('test-bucket', 'source.csv', 'destination.csv');

      expect(__mockCopy).toHaveBeenCalledWith('destination.csv');
    });
  });
});
