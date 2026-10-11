
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({ region: 'ap-south-1' });

const tips = [
  {
    tip: 'Report leaking taps and toilets to building maintenance promptly.',
    tagline: 'Small fixes today. A water-secure tomorrow.',
  },
  {
    tip: 'Turn off the tap while brushing your teeth and use only the water you need.',
    tagline: 'Better habits. Less waste. A greener home.',
  },
  {
    tip: 'Where approved and safe, use treated wastewater for suitable non-drinking purposes.',
    tagline: 'Reuse wisely. Let every litre do more.',
  },
  {
    tip: 'Run washing machines with suitable full loads to avoid unnecessary water use.',
    tagline: 'Every cycle counts. Every drop matters.',
  },
  {
    tip: 'Tell building management about overflowing tanks or unusual water leaks.',
    tagline: 'Notice a leak. Make a difference.',
  },
];

export const handler = async () => {
  const sender = process.env.SENDER_EMAIL;
const recipients = (process.env.RECIPIENT_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim())
  .filter(Boolean);

  if (!sender) {
    throw new Error('SENDER_EMAIL is not configured.');
  }
  if (recipients.length === 0) {
  throw new Error('RECIPIENT_EMAILS is not configured.');
}

  const dayNumber = Math.floor(Date.now() / 86400000);
  const dailyTip = tips[dayNumber % tips.length];

  const report = [
    'REFLOW - DAILY WATER UPDATE (DEMO DATA)',
    '',
    'Hello!',
    '',
    "Today's building water update (illustrative sample figures):",
    '- Treated water reused: 10,000 L',
    '- Freshwater used: 3,000 L',
    '- Freshwater replaced: 7,000 L',
    '',
    `Today's water-saving tip: ${dailyTip.tip}`,
    '',
    dailyTip.tagline,
    '',
    'These figures are simulated for demonstration and are not actual building measurements.',
  ].join('\n');

  await ses.send(
    new SendEmailCommand({
      Source: sender,
      Destination: {
    ToAddresses: [sender],
    BccAddresses: recipients.filter(
        (email) => email.toLowerCase() !== sender.toLowerCase(),
  ),
},
      Message: {
        Subject: {
          Data: 'ReFlow - Daily Water Update (Demo Data)',
          Charset: 'UTF-8',
        },
        Body: {
          Text: {
            Data: report,
            Charset: 'UTF-8',
          },
        },
      },
    }),
  );

  console.log('ReFlow demo email sent to the verified sender address.');

  return { statusCode: 200, body: 'Demo email sent.' };
};
