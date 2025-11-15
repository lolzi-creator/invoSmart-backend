// Quick script to help identify what needs translating
const fs = require('fs');

const file = '/Users/up278820/anis/invoSmart-backend/src/services/emailService.ts';
const content = fs.readFileSync(file, 'utf8');

// Find all hardcoded German text that should be translated
const germanTexts = [
  '3. und letzte Mahnung',
  'Letzte Zahlungsaufforderung',
  'DRINGEND',
  'Dies ist unsere letzte Mahnung',
  'Neue Rechnung',
  'Vielen Dank für Ihr Vertrauen',
  'Neue Offerte',
  'Sehr geehrte/r',
  'Freundliche Grüsse'
];

console.log('Checking for untranslated German text in email templates...\n');

let lineNum = 1;
const lines = content.split('\n');
for (const line of lines) {
  for (const text of germanTexts) {
    if (line.includes(text) && !line.includes('${t.')) {
      console.log(`Line ${lineNum}: ${line.trim()}`);
    }
  }
  lineNum++;
}

