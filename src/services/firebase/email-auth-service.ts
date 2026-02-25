import auth from "@react-native-firebase/auth";
import { CustomOtpAuthService } from "@/services/firebase/custom-otp-auth-service";
import type { OtpStartResponse, OtpVerifyResponse } from "@/types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

function assertValidEmail(email: string): void {
  if (!EMAIL_REGEX.test(email)) {
    throw new Error("INVALID_EMAIL");
  }
}

function assertValidPassword(password: string): void {
  if (password.trim().length < MIN_PASSWORD_LENGTH) {
    throw new Error("WEAK_PASSWORD");
  }
}

export class EmailAuthService {
  static isEmailValid(input: string): boolean {
    return EMAIL_REGEX.test(normalizeEmail(input));
  }

  static async signInWithEmailAndPassword(
    email: string,
    password: string,
  ): Promise<void> {
    const normalizedEmail = normalizeEmail(email);
    assertValidEmail(normalizedEmail);
    assertValidPassword(password);
    await auth().signInWithEmailAndPassword(normalizedEmail, password);
  }

  static async signUpWithEmailAndPassword(
    email: string,
    password: string,
  ): Promise<void> {
    const normalizedEmail = normalizeEmail(email);
    assertValidEmail(normalizedEmail);
    assertValidPassword(password);
    await auth().createUserWithEmailAndPassword(normalizedEmail, password);
  }

  static async sendPasswordReset(email: string): Promise<void> {
    const normalizedEmail = normalizeEmail(email);
    assertValidEmail(normalizedEmail);
    await auth().sendPasswordResetEmail(normalizedEmail);
  }

  static async requestOtpCodeByEmail(email: string): Promise<OtpStartResponse> {
    const normalizedEmail = normalizeEmail(email);
    assertValidEmail(normalizedEmail);
    return CustomOtpAuthService.requestOtpCodeByEmail(normalizedEmail);
  }

  static async signInWithEmailOtp(
    challengeId: string,
    code: string,
  ): Promise<OtpVerifyResponse> {
    return CustomOtpAuthService.signInWithOtp(challengeId, code);
  }
}
