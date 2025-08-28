// src/services/emailService.js
import { toast } from 'react-hot-toast';

/**
 * emailService simulates sending email notifications
 * to both the client and the SafeBox owner whenever
 * files are added, updated, or deleted.
 */
export const emailService = {
  /**
   * Notify parties about a file action.
   *
   * @param {'added'|'updated'|'deleted'} action   - Type of action performed
   * @param {string[]} fileNames                   - Names of the files affected
   * @param {number} boxId                         - ID of the SafeBox
   * @param {{ username: string }} user            - Logged-in user info
   */
  notifyFileAction(action, fileNames, boxId, user) {
    // Demo recipient addresses
    const recipients = [
      `${user.username}@example.com`,   // the client’s email
      `owner${boxId}@example.com`,      // the SafeBox owner’s email
    ];

    recipients.forEach((email) => {
      // In a real app, replace this console.log with your mail API call
      console.log(
        `Sending "${action}" notification for files [${fileNames.join(
          ', '
        )}] in box #${boxId} to ${email}`
      );
      // And show a toast for demo feedback
      toast.success(`Notification email sent to ${email}`);
    });
  },
  /**
   * Send a session summary email (simulated) per safebox to owner and authorized users.
   * @param {{ username: string }} user
   * @param {string} safeBoxName
   * @param {string[]} recipients
   * @param {{ startedAt: string, endedAt: string, perFolder: Array<{ folder: string, added: number, updated: number, deleted: number, foldersCreated: number, foldersDeleted: number }> }} summary
   */
  sendSessionSummary(user, safeBoxName, recipients, summary) {
    const subject = `VaultEdge session summary for ${safeBoxName}`;
    const lines = [
      `Session: ${summary.startedAt} → ${summary.endedAt}`,
      `Safebox: ${safeBoxName}`,
      '',
      ...summary.perFolder.map(r => `• ${r.folder || '/'} — added:${r.added}, updated:${r.updated}, deleted:${r.deleted}, new-folders:${r.foldersCreated}, deleted-folders:${r.foldersDeleted}`)
    ];
    const body = lines.join('\n');
    recipients.forEach(email => {
      console.log(`[email] To: ${email}\nSubject: ${subject}\n\n${body}`);
      toast.success(`Session summary sent to ${email}`);
    });
  }
};
