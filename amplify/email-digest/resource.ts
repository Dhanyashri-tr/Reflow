
import { defineFunction } from '@aws-amplify/backend';

export const emailDigest = defineFunction({
  name: 'email-digest',
  entry: './handler.ts',
  schedule: 'every day',
});
