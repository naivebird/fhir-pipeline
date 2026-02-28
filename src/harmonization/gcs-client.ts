import { Storage } from '@google-cloud/storage';

export class GCSClient {
  private storage: Storage;

  constructor() {
    this.storage = new Storage();
  }

  async downloadFile(bucketName: string, fileName: string): Promise<string> {
    const bucket = this.storage.bucket(bucketName);
    const file = bucket.file(fileName);

    const [content] = await file.download();
    return content.toString('utf-8');
  }

  async moveFile(
    bucketName: string,
    sourceFileName: string,
    destinationFileName: string
  ): Promise<void> {
    const bucket = this.storage.bucket(bucketName);
    const sourceFile = bucket.file(sourceFileName);

    await sourceFile.move(destinationFileName);
  }

  async copyFile(
    bucketName: string,
    sourceFileName: string,
    destinationFileName: string
  ): Promise<void> {
    const bucket = this.storage.bucket(bucketName);
    const sourceFile = bucket.file(sourceFileName);

    await sourceFile.copy(destinationFileName);
  }

  getFileType(fileName: string): 'csv' | 'hl7v2' | 'synthea' | 'unknown' {
    if (fileName.startsWith('csv-ehr/')) {
      return 'csv';
    }
    if (fileName.startsWith('hl7v2/')) {
      return 'hl7v2';
    }
    if (fileName.startsWith('synthea/')) {
      return 'synthea';
    }
    return 'unknown';
  }

  shouldProcess(fileName: string): boolean {
    // Skip .gitkeep files and files in processed/ prefix
    if (fileName.endsWith('.gitkeep')) return false;
    if (fileName.startsWith('processed/')) return false;

    // Only process files in recognized prefixes
    return this.getFileType(fileName) !== 'unknown';
  }
}
