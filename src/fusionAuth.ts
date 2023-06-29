import { FusionAuthClient } from '@fusionauth/typescript-client';
import fetch from 'node-fetch';

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

export interface LoginResponse {
  token?: string;
  refreshToken?: string;
  tokenExpirationInstant?: number;
  twoFactorId?: string;
  methods?: string[];
}

export class ClientResponse<T> {
  public statusCode: number;

  public response: T;

  public exception: Error;

  wasSuccessful(): boolean {
    return this.statusCode >= 200 && this.statusCode < 300;
  }
}

export class FusionAuthApiClient {
  private readonly baseUrl: string;

  private readonly headers: Record<string, string>;

  private readonly applicationId: string = process.env.FUSION_AUTH_APP_ID ?? '';

  constructor(apiKey: string = process.env.FUSION_AUTH_KEY ?? '', baseUrl: string = process.env.FUSION_AUTH_HOST ?? '') {
    this.baseUrl = baseUrl;
    this.headers = {
      Authorization: `${apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  public async login(loginId: string, password: string, applicationId: string = this.applicationId): Promise<ClientResponse<LoginResponse>> {
    return new Promise((resolve, reject) => {
      fetch(`${this.baseUrl}/api/login`, {
        method: 'POST',
        body: JSON.stringify({
          loginId,
          password,
          applicationId,
        }),
        headers: this.headers,
      }).then(async (response) => {
        const clientResponse = new ClientResponse<LoginResponse>();
        clientResponse.statusCode = response.status;
        const responseBody: LoginResponse = await response.json();
        if (response.ok) {
          clientResponse.response = responseBody;
        } else {
          const err: Error = { name: '', message: JSON.stringify(responseBody) };
          clientResponse.exception = err;
        }
        resolve(clientResponse);
      }).catch((err) => {
        reject(err);
      });
    });
  }
}
