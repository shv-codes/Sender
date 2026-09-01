import * as QRCode from 'qrcode';

export class QRService {
  /**
   * Generates a Data URI containing the base64-encoded QR code image.
   * Encodes just the short string directly.
   */
  async generateQRCode(code: string): Promise<string> {
    try {
      // Returns a data URL (e.g., "data:image/png;base64,...")
      return await QRCode.toDataURL(code, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 200,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
    } catch (err) {
      console.error('Failed to generate QR code', err);
      throw err;
    }
  }
}
