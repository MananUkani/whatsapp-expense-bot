// WhatsApp Expense Bot using Baileys + Google Sheets

const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { google } = require('googleapis');

// Budget in memory (simple version)
let budget = 500;

// Google Sheets setup
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_PROJECT_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });
const SHEET_ID = process.env.SHEET_ID;

async function appendExpense(category, amount, remaining) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Expenses!A:D',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[new Date().toISOString(), category, amount, remaining]],
    },
  });
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({ auth: state });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || !msg.message.conversation) return;

    const text = msg.message.conversation.toLowerCase();
    const from = msg.key.remoteJid;

    if (text.startsWith('used')) {
      const match = text.match(/^used\s+(\d+)\s+for\s+(.+)$/);
      if (match) {
        const amount = parseFloat(match[1]);
        const category = match[2];
        budget -= amount;

        await appendExpense(category, amount, budget);
        await sock.sendMessage(from, { text: `✅ Added: ${amount} for ${category}\nRemaining budget: ${budget}` });
      } else {
        await sock.sendMessage(from, { text: 'Format: used 25 for flowers' });
      }
    } else if (text.startsWith('set budget')) {
      const m = text.match(/^set budget\s+(\d+)$/);
      if (m) {
        budget = parseFloat(m[1]);
        await sock.sendMessage(from, { text: `✅ Budget set to ${budget}` });
      }
    } else if (text === 'balance') {
      await sock.sendMessage(from, { text: `Remaining budget: ${budget}` });
    } else {
      await sock.sendMessage(from, { text: 'Commands:\n- used 25 for flowers\n- set budget 1000\n- balance' });
    }
  });
}

startBot();
