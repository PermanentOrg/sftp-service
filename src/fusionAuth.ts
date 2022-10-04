import { FusionAuthClient } from '@fusionauth/typescript-client';

export const getFusionAuthClient = (): FusionAuthClient => new FusionAuthClient(
  process.env.FUSION_AUTH_KEY ?? '',
  process.env.FUSION_AUTH_HOST ?? '',
);

export interface PartialClientResponse {
  exception: {
    message: string;
  };
}

export const isPartialClientResponse = (obj: unknown): obj is PartialClientResponse => (
  typeof obj === 'object'
    && obj !== null
    && 'exception' in obj
);
