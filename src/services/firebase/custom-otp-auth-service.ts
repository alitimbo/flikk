import { getFunctions, httpsCallable } from "@react-native-firebase/functions";
import { getAuth, signInWithCustomToken } from "@react-native-firebase/auth";
import type {
  OtpStartRequest,
  OtpStartResponse,
  OtpVerifyRequest,
  OtpVerifyResponse,
} from "@/types";

export class CustomOtpAuthService {
  private static get functions() {
    return getFunctions(undefined, "us-central1");
  }

  static async requestOtpCode(phoneNumber: string): Promise<OtpStartResponse> {
    return this.requestOtpChallenge({
      channel: "sms",
      phoneNumber,
    });
  }

  static async requestOtpCodeByEmail(email: string): Promise<OtpStartResponse> {
    return this.requestOtpChallenge({
      channel: "email",
      email,
    });
  }

  static async requestOtpChallenge(
    payload: OtpStartRequest,
  ): Promise<OtpStartResponse> {
    const call = httpsCallable<OtpStartRequest, OtpStartResponse>(
      this.functions,
      "requestOtpCode",
    );
    const result = await call(payload);
    return result.data;
  }

  static async verifyOtpCode(
    challengeId: string,
    code: string,
  ): Promise<OtpVerifyResponse> {
    const call = httpsCallable<OtpVerifyRequest, OtpVerifyResponse>(
      this.functions,
      "verifyOtpCode",
    );
    const result = await call({ challengeId, code });
    return result.data;
  }

  static async signInWithOtp(
    challengeId: string,
    code: string,
  ): Promise<OtpVerifyResponse> {
    const payload = await this.verifyOtpCode(challengeId, code);
    await signInWithCustomToken(getAuth(), payload.customToken);
    return payload;
  }
}
