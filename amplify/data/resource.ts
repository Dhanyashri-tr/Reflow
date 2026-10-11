
import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Supply: a
    .model({
      buildingId: a.string(),
      date: a.date().required(),
      availableLitres: a.integer().required(),
      sourceLabel: a.string().required(),
      notes: a.string(),
    })
    .authorization((allow) => [allow.group('BuildingStaff')]),

  AllocationPlan: a
    .model({
      buildingId: a.string(),
      date: a.date().required(),
      supplyLitres: a.integer().required(),
      toiletFlushingLitres: a.integer().required(),
      landscapingLitres: a.integer().required(),
      cleaningLitres: a.integer().required(),
      recommendedReuseLitres: a.integer().required(),
      status: a.string().required(),
    })
    .authorization((allow) => [allow.group('BuildingStaff')]),

  ActualUsage: a
    .model({
      buildingId: a.string(),
      date: a.date().required(),
      planId: a.string().required(),
      useType: a.string().required(),
      deliveredLitres: a.integer().required(),
      freshwaterReplacedLitres: a.integer().required(),
      confirmed: a.boolean().required(),
      notes: a.string(),
    })
    .authorization((allow) => [allow.group('BuildingStaff')]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
