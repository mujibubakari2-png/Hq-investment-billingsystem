import * as keytar from 'keytar';

const SERVICE_NAME = 'HQInvestment_ISP_MikroTik';

export class CredentialService {
  /**
   * Securely retrieve the password for a given router IP and username
   */
  static async getPassword(ip: string, username: string): Promise<string | null> {
    const account = `${ip}:${username}`;
    try {
      return await keytar.getPassword(SERVICE_NAME, account);
    } catch (error) {
      console.error('[CredentialService] Error retrieving password:', error);
      return null;
    }
  }

  /**
   * Securely store the password in the OS Keychain / Windows Credential Manager
   */
  static async setPassword(ip: string, username: string, password: string): Promise<void> {
    const account = `${ip}:${username}`;
    try {
      await keytar.setPassword(SERVICE_NAME, account, password);
    } catch (error) {
      console.error('[CredentialService] Error saving password:', error);
    }
  }

  /**
   * Remove a saved password
   */
  static async deletePassword(ip: string, username: string): Promise<void> {
    const account = `${ip}:${username}`;
    try {
      await keytar.deletePassword(SERVICE_NAME, account);
    } catch (error) {
      console.error('[CredentialService] Error deleting password:', error);
    }
  }
}
