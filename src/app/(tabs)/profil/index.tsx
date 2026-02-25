import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { FirebaseAuthTypes } from "@react-native-firebase/auth";
import appCheck from "@react-native-firebase/app-check";
import auth, { PhoneAuthProvider } from "@react-native-firebase/auth";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { MediaPicker } from "@/components/ui/MediaPicker";
import { useUserProfile } from "@/hooks/useUserProfile";
import type { OtpChannel, WithdrawalMethod } from "@/types";
import * as WebBrowser from "expo-web-browser";
import { setLanguage } from "@/i18n";
import { CustomOtpAuthService } from "@/services/firebase/custom-otp-auth-service";
import { EmailAuthService } from "@/services/firebase/email-auth-service";
import { MMKVStorage } from "@/storage/mmkv";

const OTP_AUTH_MODE = (
  process.env.EXPO_PUBLIC_OTP_AUTH_MODE || "hybrid"
).toLowerCase();
const USE_CUSTOM_OTP = OTP_AUTH_MODE !== "firebase";
const USE_FIREBASE_FALLBACK =
  OTP_AUTH_MODE === "hybrid" || OTP_AUTH_MODE === "firebase";
const FIREBASE_VERIFICATION_ID_KEY = "auth.firebase.verificationId";
const FIREBASE_PENDING_PHONE_KEY = "auth.firebase.pendingPhone";
const DEFAULT_AUTH_METHOD = (
  process.env.EXPO_PUBLIC_AUTH_DEFAULT_METHOD || "email"
).toLowerCase();
const MIN_PASSWORD_LENGTH = 6;

export default function ProfilIndex() {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [authUser, setAuthUser] = useState<FirebaseAuthTypes.User | null>(null);

  // Login State
  const [authMethod, setAuthMethod] = useState<"phone" | "email">(
    DEFAULT_AUTH_METHOD === "phone" ? "phone" : "email",
  );
  const [emailMode, setEmailMode] = useState<"login" | "signup" | "otp">(
    "login",
  );
  const [phoneNumber, setPhoneNumber] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [confirmation, setConfirmation] =
    useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [firebaseVerificationId, setFirebaseVerificationId] = useState<
    string | null
  >(null);
  const [otpStrategy, setOtpStrategy] = useState<"custom" | "firebase" | null>(
    null,
  );
  const [otpChannel, setOtpChannel] = useState<OtpChannel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [countryIndex, setCountryIndex] = useState(0);
  const [showCountryList, setShowCountryList] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const resendTimer = useRef<NodeJS.Timeout | null>(null);
  const supportUrl = "https://wa.me/22788032384";
  const policyUrl = "https://belemdev.tech";

  // Profile Data Hook
  const {
    data: userProfile,
    updateProfile,
    uploadLogo,
    isUpdating,
    isLoading: isProfileLoading,
  } = useUserProfile(authUser?.uid);

  // Completion Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [isMerchant, setIsMerchant] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [address, setAddress] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [withdrawalMethod, setWithdrawalMethod] =
    useState<WithdrawalMethod>("nita");
  const [withdrawalNumber, setWithdrawalNumber] = useState("");
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  const COUNTRIES = useMemo(
    () => [
      { code: "NE", name: "Niger", dial: "+227" },
      { code: "ML", name: "Mali", dial: "+223" },
    ],
    [],
  );

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((user) => {
      setAuthUser(user);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const savedVerificationId = MMKVStorage.getItem(
      FIREBASE_VERIFICATION_ID_KEY,
    );
    const savedPhone = MMKVStorage.getItem(FIREBASE_PENDING_PHONE_KEY);
    if (savedVerificationId) {
      setFirebaseVerificationId(savedVerificationId);
      setOtpStrategy("firebase");
      setOtpChannel("sms");
      setAuthMethod("phone");
    }
    if (savedPhone && !phoneNumber) {
      setPhoneNumber(savedPhone);
    }
  }, [phoneNumber]);

  // Sync form states with profile data only when NOT editing to prevent loops and data loss
  useEffect(() => {
    if (userProfile && !isEditing) {
      setFirstName(userProfile.firstName || "");
      setLastName(userProfile.lastName || "");
      setEmail(userProfile.email || "");
      setIsMerchant(userProfile.isMerchant || false);
      if (userProfile.merchantInfo) {
        setBusinessName(userProfile.merchantInfo.businessName || "");
        setTaxId(userProfile.merchantInfo.taxId || "");
        setAddress(userProfile.merchantInfo.address || "");
        setBusinessPhone(userProfile.merchantInfo.businessPhone || "");
        setWithdrawalMethod(
          userProfile.merchantInfo.withdrawalMethod || "nita",
        );
        setWithdrawalNumber(userProfile.merchantInfo.withdrawalNumber || "");
        setLogoUri(userProfile.merchantInfo.logoUrl || null);
      }
    }
  }, [userProfile, isEditing]);

  useEffect(() => {
    if (resendSeconds <= 0) {
      if (resendTimer.current) clearInterval(resendTimer.current);
      resendTimer.current = null;
      return;
    }
    resendTimer.current = setInterval(() => {
      setResendSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => {
      if (resendTimer.current) clearInterval(resendTimer.current);
      resendTimer.current = null;
    };
  }, [resendSeconds]);

  const normalizedAuthEmail = useMemo(
    () => authEmail.trim().toLowerCase(),
    [authEmail],
  );
  const isAuthEmailValid = useMemo(
    () => EmailAuthService.isEmailValid(normalizedAuthEmail),
    [normalizedAuthEmail],
  );
  const canSendPhoneCode = useMemo(
    () => phoneNumber.trim().length >= 8 && resendSeconds === 0,
    [phoneNumber, resendSeconds],
  );
  const canSendEmailOtp = useMemo(
    () => isAuthEmailValid && resendSeconds === 0,
    [isAuthEmailValid, resendSeconds],
  );
  const canSignInWithEmailPassword = useMemo(
    () =>
      isAuthEmailValid && authPassword.trim().length >= MIN_PASSWORD_LENGTH,
    [isAuthEmailValid, authPassword],
  );
  const canSignUpWithEmailPassword = useMemo(
    () =>
      isAuthEmailValid &&
      authPassword.trim().length >= MIN_PASSWORD_LENGTH &&
      authPassword === authPasswordConfirm,
    [isAuthEmailValid, authPassword, authPasswordConfirm],
  );
  const hasPendingOtpChallenge = useMemo(
    () => !!challengeId || !!confirmation || !!firebaseVerificationId,
    [challengeId, confirmation, firebaseVerificationId],
  );
  const isPendingEmailOtp = useMemo(
    () =>
      hasPendingOtpChallenge &&
      otpChannel === "email" &&
      otpStrategy === "custom",
    [hasPendingOtpChallenge, otpChannel, otpStrategy],
  );
  const canConfirm = useMemo(() => smsCode.trim().length >= 4, [smsCode]);
  const currentLanguage = useMemo(
    () => (i18n.language?.startsWith("en") ? "en" : "fr"),
    [i18n.language],
  );
  const canSaveMerchant =
    !isMerchant ||
    (businessName.trim().length > 0 &&
      address.trim().length > 0 &&
      businessPhone.trim().length > 0 &&
      withdrawalNumber.trim().length > 0 &&
      !!logoUri);

  const resetOtpSession = useCallback(() => {
    setChallengeId(null);
    setConfirmation(null);
    setFirebaseVerificationId(null);
    MMKVStorage.removeItem(FIREBASE_VERIFICATION_ID_KEY);
    MMKVStorage.removeItem(FIREBASE_PENDING_PHONE_KEY);
    setOtpStrategy(null);
    setOtpChannel(null);
    setSmsCode("");
    setResendSeconds(0);
  }, []);

  const handleSelectAuthMethod = useCallback(
    (nextMethod: "phone" | "email") => {
      if (nextMethod === authMethod) {
        return;
      }
      resetOtpSession();
      setAuthMethod(nextMethod);
      setShowCountryList(false);
      setErrorMessage(null);
      setInfoMessage(null);
    },
    [authMethod, resetOtpSession],
  );

  const handleSelectEmailMode = useCallback(
    (nextMode: "login" | "signup" | "otp") => {
      if (nextMode === emailMode) {
        return;
      }
      resetOtpSession();
      setEmailMode(nextMode);
      setErrorMessage(null);
      setInfoMessage(null);
    },
    [emailMode, resetOtpSession],
  );

  const handleSendCode = useCallback(async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    if (!canSendPhoneCode) return;
    try {
      setIsLoading(true);
      const fullPhone = `${COUNTRIES[countryIndex].dial}${phoneNumber.trim()}`;

      if (USE_CUSTOM_OTP) {
        try {
          const result = await CustomOtpAuthService.requestOtpCode(fullPhone);
          setChallengeId(result.challengeId);
          setConfirmation(null);
          setOtpStrategy("custom");
          setOtpChannel("sms");
          setResendSeconds(Number(result.resendAfterSec || 30));
          return;
        } catch (customError) {
          console.log("Custom OTP send failed", customError);
        }
      }

      if (!USE_FIREBASE_FALLBACK) {
        throw new Error("OTP_CUSTOM_FAILED_NO_FALLBACK");
      }

      const tokenResult = await appCheck().getToken(true);

      if (!tokenResult?.token) {
        throw new Error("App Check token manquant");
      }

      console.log("App Check token:", tokenResult?.token);
      const firebaseConfirmation =
        await auth().signInWithPhoneNumber(fullPhone);

      setConfirmation(firebaseConfirmation);
      setFirebaseVerificationId(firebaseConfirmation.verificationId);
      MMKVStorage.setItem(
        FIREBASE_VERIFICATION_ID_KEY,
        firebaseConfirmation.verificationId as string,
      );
      MMKVStorage.setItem(FIREBASE_PENDING_PHONE_KEY, phoneNumber.trim());
      setChallengeId(null);
      setOtpStrategy("firebase");
      setOtpChannel("sms");
      setResendSeconds(30);
    } catch (error) {
      console.log("Error sending code", error);
      setErrorMessage(t("profile.login.errorSend"));
    } finally {
      setIsLoading(false);
    }
  }, [canSendPhoneCode, phoneNumber, countryIndex, COUNTRIES, t]);

  const handleSendEmailOtp = useCallback(async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    if (!canSendEmailOtp) return;

    try {
      setIsLoading(true);
      const result =
        await EmailAuthService.requestOtpCodeByEmail(normalizedAuthEmail);
      setChallengeId(result.challengeId);
      setConfirmation(null);
      setFirebaseVerificationId(null);
      setOtpStrategy("custom");
      setOtpChannel("email");
      setEmailMode("otp");
      setResendSeconds(Number(result.resendAfterSec || 30));
    } catch (error) {
      console.log("Error sending email OTP", error);
      setErrorMessage(t("profile.login.errorSendEmail"));
    } finally {
      setIsLoading(false);
    }
  }, [canSendEmailOtp, normalizedAuthEmail, t]);

  const handleEmailSignIn = useCallback(async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    if (!canSignInWithEmailPassword) return;

    try {
      setIsLoading(true);
      await EmailAuthService.signInWithEmailAndPassword(
        normalizedAuthEmail,
        authPassword,
      );
    } catch (error) {
      console.log("Email sign in failed", error);
      setErrorMessage(t("profile.login.errorEmailLogin"));
    } finally {
      setIsLoading(false);
    }
  }, [canSignInWithEmailPassword, normalizedAuthEmail, authPassword, t]);

  const handleEmailSignUp = useCallback(async () => {
    setErrorMessage(null);
    setInfoMessage(null);

    if (authPassword !== authPasswordConfirm) {
      setErrorMessage(t("profile.login.errorPasswordMismatch"));
      return;
    }
    if (!canSignUpWithEmailPassword) return;

    try {
      setIsLoading(true);
      await EmailAuthService.signUpWithEmailAndPassword(
        normalizedAuthEmail,
        authPassword,
      );
    } catch (error) {
      console.log("Email sign up failed", error);
      setErrorMessage(t("profile.login.errorEmailSignup"));
    } finally {
      setIsLoading(false);
    }
  }, [
    authPassword,
    authPasswordConfirm,
    canSignUpWithEmailPassword,
    normalizedAuthEmail,
    t,
  ]);

  const handleResetPassword = useCallback(async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    if (!isAuthEmailValid) return;

    try {
      setIsLoading(true);
      await EmailAuthService.sendPasswordReset(normalizedAuthEmail);
      setInfoMessage(t("profile.login.resetSent"));
    } catch (error) {
      console.log("Password reset failed", error);
      setErrorMessage(t("profile.login.errorResetPassword"));
    } finally {
      setIsLoading(false);
    }
  }, [isAuthEmailValid, normalizedAuthEmail, t]);

  const handleConfirmCode = useCallback(async () => {
    if (!canConfirm) return;
    try {
      setErrorMessage(null);
      setInfoMessage(null);
      setIsLoading(true);
      if (otpStrategy === "custom" && challengeId) {
        if (otpChannel === "email") {
          await EmailAuthService.signInWithEmailOtp(challengeId, smsCode.trim());
        } else {
          await CustomOtpAuthService.signInWithOtp(challengeId, smsCode.trim());
        }
      } else if (otpStrategy === "firebase" && confirmation) {
        await confirmation.confirm(smsCode.trim());
      } else if (otpStrategy === "firebase" && firebaseVerificationId) {
        const credential = PhoneAuthProvider.credential(
          firebaseVerificationId,
          smsCode.trim(),
        );

        await auth().signInWithCredential(credential);
      } else {
        throw new Error("NO_OTP_SESSION");
      }
      resetOtpSession();
    } catch (error) {
      console.log("Error confirming code", error);
      setErrorMessage(
        otpChannel === "email"
          ? t("profile.login.errorCodeEmail")
          : t("profile.login.errorCode"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    canConfirm,
    challengeId,
    confirmation,
    firebaseVerificationId,
    otpStrategy,
    otpChannel,
    resetOtpSession,
    smsCode,
    t,
  ]);

  const handleSignOut = useCallback(async () => {
    await auth().signOut();
  }, []);

  const handleToggleLanguage = useCallback(async () => {
    const nextLanguage = currentLanguage === "fr" ? "en" : "fr";
    await setLanguage(nextLanguage);
  }, [currentLanguage]);

  const openSupport = useCallback(async () => {
    await WebBrowser.openBrowserAsync(supportUrl);
  }, [supportUrl]);

  const openPolicy = useCallback(async () => {
    await WebBrowser.openBrowserAsync(policyUrl);
  }, [policyUrl]);

  const handleSaveProfile = async () => {
    if (!authUser || !firstName || !lastName) return;
    if (isMerchant && !canSaveMerchant) return;

    try {
      let finalLogoUrl = logoUri;

      // Upload logo if it's a local URI (not already an HTTP URL)
      if (logoUri && !logoUri.startsWith("http")) {
        finalLogoUrl = await uploadLogo(logoUri);
      }

      await updateProfile({
        uid: authUser.uid,
        phoneNumber: authUser.phoneNumber || "",
        firstName,
        lastName,
        email,
        isMerchant,
        role: isMerchant ? "merchant" : "customer",
        status: "active",
        merchantInfo: isMerchant
          ? {
              businessName,
              taxId,
              address,
              businessPhone,
              withdrawalMethod,
              withdrawalNumber,
              logoUrl: finalLogoUrl || "",
            }
          : undefined,
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving profile:", error);
    }
  };

  if (authUser) {
    // 1. Loading State
    if (isProfileLoading) {
      return (
        <View className="flex-1 items-center justify-center bg-flikk-dark">
          <ActivityIndicator color="#CCFF00" />
        </View>
      );
    }

    // 2. Profile Completion Form (if incomplete or editing)
    if (!userProfile?.firstName || isEditing) {
      return (
        <KeyboardAvoidingView
          className="flex-1 bg-flikk-dark"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
          style={{ paddingTop: insets.top }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                padding: 20,
                paddingBottom: insets.bottom + 40,
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="font-display text-2xl text-flikk-text">
                    {userProfile?.firstName
                      ? t("profile.edit.title")
                      : t("profile.completion.title")}
                  </Text>
                  <Text className="mt-2 text-base text-flikk-text-muted">
                    {userProfile?.firstName
                      ? t("profile.edit.subtitle")
                      : t("profile.completion.subtitle")}
                  </Text>
                </View>
                {isEditing && (
                  <Pressable
                    onPress={() => setIsEditing(false)}
                    className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
                  >
                    <Ionicons name="close" size={24} color="#FFFFFF" />
                  </Pressable>
                )}
              </View>

              <View className="mt-8 gap-4">
                <TextInput
                  className="h-14 w-full rounded-2xl border border-white/10 bg-flikk-card px-4 font-body text-base text-flikk-text"
                  placeholder={t("profile.completion.firstName")}
                  placeholderTextColor="#666666"
                  value={firstName}
                  onChangeText={setFirstName}
                />
                <TextInput
                  className="h-14 w-full rounded-2xl border border-white/10 bg-flikk-card px-4 font-body text-base text-flikk-text"
                  placeholder={t("profile.completion.lastName")}
                  placeholderTextColor="#666666"
                  value={lastName}
                  onChangeText={setLastName}
                />
                <TextInput
                  className="h-14 w-full rounded-2xl border border-white/10 bg-flikk-card px-4 font-body text-base text-flikk-text"
                  placeholder={t("profile.completion.email")}
                  placeholderTextColor="#666666"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <View className="mt-4 flex-row items-center justify-between rounded-2xl border border-white/20 bg-white p-4">
                  <Text className="font-display text-base text-[#121212]">
                    {t("profile.completion.isMerchant")}
                  </Text>
                  <Switch
                    value={isMerchant}
                    onValueChange={setIsMerchant}
                    trackColor={{ false: "#D1D5DB", true: "#CCFF00" }}
                    thumbColor={isMerchant ? "#121212" : "#B3B3B3"}
                  />
                </View>

                {isMerchant && (
                  <View className="gap-4 border-l-2 border-flikk-lime pl-4">
                    <Text className="mt-2 font-display text-lg text-flikk-lime">
                      {t("profile.completion.merchantInfo")}
                    </Text>

                    <Pressable
                      onPress={() => setShowMediaPicker(true)}
                      className="h-32 w-32 items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/5"
                    >
                      {logoUri ? (
                        <Image
                          source={{ uri: logoUri }}
                          className="h-full w-full rounded-2xl"
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="items-center">
                          <Ionicons
                            name="camera-outline"
                            size={32}
                            color="#666666"
                          />
                          <Text className="mt-2 text-xs text-flikk-text-muted">
                            {t("profile.completion.uploadLogo")}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                    <Text className="text-xs text-flikk-text-muted">
                      {t("profile.completion.logoHint")}
                      <Text className="text-[#FF4D6D]"> *</Text>
                    </Text>

                    <Text className="text-sm font-bold text-flikk-text-muted mb-1 uppercase tracking-widest pl-1">
                      {t("profile.completion.businessName")}
                      <Text className="text-[#FF4D6D]"> *</Text>
                    </Text>
                    <TextInput
                      className="h-14 w-full rounded-2xl border border-white/10 bg-flikk-card px-4 font-body text-base text-flikk-text"
                      placeholder={t("profile.completion.businessName")}
                      placeholderTextColor="#666666"
                      value={businessName}
                      onChangeText={setBusinessName}
                    />

                    <Text className="text-sm font-bold text-flikk-text-muted mb-1 uppercase tracking-widest pl-1">
                      {t("profile.completion.address")}
                      <Text className="text-[#FF4D6D]"> *</Text>
                    </Text>
                    <TextInput
                      className="h-14 w-full rounded-2xl border border-white/10 bg-flikk-card px-4 font-body text-base text-flikk-text"
                      placeholder={t("profile.completion.address")}
                      placeholderTextColor="#666666"
                      value={address}
                      onChangeText={setAddress}
                    />

                    <Text className="text-sm font-bold text-flikk-text-muted mb-1 uppercase tracking-widest pl-1">
                      {t("profile.completion.businessPhone")}
                      <Text className="text-[#FF4D6D]"> *</Text>
                    </Text>
                    <TextInput
                      className="h-14 w-full rounded-2xl border border-white/10 bg-flikk-card px-4 font-body text-base text-flikk-text"
                      placeholder={t("profile.completion.businessPhone")}
                      placeholderTextColor="#666666"
                      value={businessPhone}
                      onChangeText={setBusinessPhone}
                      keyboardType="phone-pad"
                    />

                    <Text className="text-sm font-bold text-flikk-text-muted mb-1 uppercase tracking-widest pl-1">
                      {t("profile.completion.taxId")}
                    </Text>
                    <Text className="text-xs text-flikk-text-muted mb-1 pl-1">
                      {t("profile.completion.taxIdOptional")}
                    </Text>
                    <TextInput
                      className="h-14 w-full rounded-2xl border border-white/10 bg-flikk-card px-4 font-body text-base text-flikk-text"
                      placeholder={t("profile.completion.taxId")}
                      placeholderTextColor="#666666"
                      value={taxId}
                      onChangeText={setTaxId}
                    />

                    <View className="mt-2">
                      <Text className="text-sm font-bold text-flikk-text-muted mb-2 uppercase tracking-widest pl-1">
                        {t("profile.completion.withdrawalMethod")}
                        <Text className="text-[#FF4D6D]"> *</Text>
                      </Text>
                      <Text className="text-xs text-flikk-text-muted mb-3">
                        {t("profile.completion.withdrawalNote")}
                      </Text>
                      <View className="gap-2">
                        {[
                          { key: "nita", label: t("profile.completion.nita") },
                          {
                            key: "amana",
                            label: t("profile.completion.amana"),
                          },
                          { key: "wave", label: t("profile.completion.wave") },
                          {
                            key: "airtel",
                            label: t("profile.completion.airtel"),
                          },
                          {
                            key: "zamani",
                            label: t("profile.completion.zamani"),
                          },
                          { key: "moov", label: t("profile.completion.moov") },
                        ].map((option) => {
                          const selected = withdrawalMethod === option.key;
                          return (
                            <Pressable
                              key={option.key}
                              onPress={() =>
                                setWithdrawalMethod(
                                  option.key as WithdrawalMethod,
                                )
                              }
                              className={`flex-row items-center justify-between rounded-2xl border px-4 py-3 ${
                                selected
                                  ? "border-flikk-lime bg-flikk-lime/10"
                                  : "border-white/10 bg-flikk-card"
                              }`}
                            >
                              <Text className="text-flikk-text font-display text-sm">
                                {option.label}
                              </Text>
                              <View
                                className={`h-5 w-5 rounded-full border items-center justify-center ${
                                  selected
                                    ? "border-flikk-lime"
                                    : "border-white/30"
                                }`}
                              >
                                {selected && (
                                  <View className="h-2.5 w-2.5 rounded-full bg-flikk-lime" />
                                )}
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                      <Text className="text-sm font-bold text-flikk-text-muted mb-1 uppercase tracking-widest pl-1 mt-3">
                        {t("profile.completion.withdrawalNumber")}
                        <Text className="text-[#FF4D6D]"> *</Text>
                      </Text>
                      <TextInput
                        className="h-14 w-full rounded-2xl border border-white/10 bg-flikk-card px-4 font-body text-base text-flikk-text"
                        placeholder={t(
                          "profile.completion.withdrawalNumberPlaceholder",
                        )}
                        placeholderTextColor="#666666"
                        value={withdrawalNumber}
                        onChangeText={setWithdrawalNumber}
                        keyboardType="phone-pad"
                      />
                    </View>
                  </View>
                )}

                <Pressable
                  className={`mt-6 h-14 items-center justify-center rounded-full bg-flikk-lime ${
                    !firstName || !lastName || !canSaveMerchant
                      ? "opacity-50"
                      : ""
                  }`}
                  onPress={handleSaveProfile}
                  disabled={
                    !firstName || !lastName || !canSaveMerchant || isUpdating
                  }
                >
                  {isUpdating ? (
                    <ActivityIndicator color="#121212" />
                  ) : (
                    <Text className="font-display text-base text-flikk-dark">
                      {t("profile.completion.save")}
                    </Text>
                  )}
                </Pressable>
              </View>
              {/* Added spacer to ensure the keyboard doesn't cover the last field */}
              <View style={{ height: 100 }} />
            </ScrollView>
          </TouchableWithoutFeedback>

          <MediaPicker
            isVisible={showMediaPicker}
            onClose={() => setShowMediaPicker(false)}
            mediaTypes={["photo"]}
            onSelect={(uri, type) => {
              if (type === "video") {
                setErrorMessage(t("mediaPicker.errorInvalidFormat"));
                setShowMediaPicker(false);
                return;
              }
              setLogoUri(uri);
              setShowMediaPicker(false);
            }}
          />
        </KeyboardAvoidingView>
      );
    }

    // 3. Completed Profile View
    return (
      <View
        className="flex-1 bg-flikk-dark"
        style={{ paddingTop: insets.top + 24 }}
      >
        <View className="mb-8 flex-row items-center justify-between px-6">
          <Text className="font-display text-3xl text-flikk-text">
            {t("profile.title")}
          </Text>
          <Pressable
            onPress={handleToggleLanguage}
            className="flex-row items-center gap-2 rounded-full bg-white/10 px-3 py-2"
          >
            <Ionicons name="globe-outline" size={18} color="#FFFFFF" />
            <Text className="font-display text-xs text-flikk-text">
              {currentLanguage.toUpperCase()}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingBottom: insets.bottom + 24,
            flexGrow: 1,
          }}
        >
          <View className="mx-6 flex-row items-center rounded-3xl border border-white/10 bg-flikk-card p-5">
            <View className="h-16 w-16 overflow-hidden items-center justify-center rounded-full bg-flikk-lime">
              {userProfile?.merchantInfo?.logoUrl ? (
                <Image
                  source={{ uri: userProfile.merchantInfo.logoUrl }}
                  className="h-full w-full"
                  resizeMode="cover"
                />
              ) : (
                <Text className="font-display text-2xl text-flikk-dark">
                  {userProfile?.firstName?.[0] ||
                    authUser.phoneNumber?.slice(-2) ||
                    "ME"}
                </Text>
              )}
            </View>
            <View className="ml-4 flex-1">
              <Text className="font-display text-lg text-flikk-text">
                {userProfile?.isMerchant
                  ? userProfile.merchantInfo?.businessName
                  : `${userProfile?.firstName} ${userProfile?.lastName}`}
              </Text>
              <Text className="mt-1 font-body text-sm text-flikk-text-muted">
                {userProfile?.phoneNumber ||
                  authUser.phoneNumber ||
                  userProfile?.email ||
                  authUser.email ||
                  "-"}
              </Text>
            </View>
          </View>

          <View className="mt-8 gap-4 px-6">
            {/* 1. Merchant Block (Top) */}
            {userProfile?.isMerchant ? (
              <Pressable
                onPress={() => setIsEditing(true)}
                className="flex-row items-center rounded-3xl border border-flikk-lime/30 bg-flikk-lime/5 p-4"
              >
                <View className="mr-4 h-10 w-10 items-center justify-center rounded-full bg-flikk-lime">
                  <Ionicons name="storefront" size={20} color="#121212" />
                </View>
                <View className="flex-1">
                  <Text className="font-display text-base text-flikk-lime">
                    {t("profile.completion.merchantInfo")}
                  </Text>
                  <Text className="mt-0.5 font-body text-xs text-flikk-text-muted">
                    {userProfile.merchantInfo?.businessName}
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color="#CCFF00" />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => {
                  setIsMerchant(true);
                  setIsEditing(true);
                }}
                className="flex-row items-center rounded-3xl border border-white/10 bg-white/5 p-4"
              >
                <View className="mr-4 h-10 w-10 items-center justify-center rounded-full bg-white/10">
                  <Ionicons name="storefront" size={20} color="#FFFFFF" />
                </View>
                <View className="flex-1">
                  <Text className="font-display text-base text-white">
                    {t("profile.menu.becomeMerchant")}
                  </Text>
                  <Text className="mt-0.5 font-body text-xs text-flikk-text-muted">
                    {t("profile.menu.becomeMerchantSubtitle")}
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color="#666666" />
              </Pressable>
            )}

            {/* 2. Mes Publications */}
            <MenuItem
              icon="cube-outline"
              title={t("profile.menu.publications")}
              subtitle={t("profile.menu.publicationsSubtitle")}
              onPress={() => router.push("/(tabs)/profil/publications")}
            />

            {userProfile?.isMerchant && (
              <MenuItem
                icon="receipt-outline"
                title={t("profile.menu.orders")}
                subtitle={t("profile.menu.ordersSubtitle")}
                onPress={() => router.push("/(tabs)/profil/orders")}
              />
            )}

            {userProfile?.isMerchant && (
              <MenuItem
                icon="storefront-outline"
                title={t("profile.menu.viewMyStore")}
                subtitle={t("profile.menu.viewMyStoreSubtitle")}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/home/merchant/[id]",
                    params: { id: authUser.uid },
                  })
                }
              />
            )}

            {/* 3. Favoris */}
            <MenuItem
              icon="heart-outline"
              title={t("profile.menu.favorites")}
              subtitle={t("profile.menu.favoritesSubtitle")}
              onPress={() => router.push("/(tabs)/profil/favorites")}
            />

            {/*
            <MenuItem
              icon="location-outline"
              title={t("profile.menu.addresses")}
              subtitle={t("profile.menu.addressesSubtitle")}
            />
            */}

            {/* 5. Modifier le Profil */}
            <MenuItem
              icon="person-outline"
              title={t("profile.menu.editProfile")}
              subtitle={t("profile.menu.editProfileSubtitle")}
              onPress={() => setIsEditing(true)}
            />

            {/* 6. Aide & Support */}
            <MenuItem
              icon="help-circle-outline"
              title={t("profile.menu.support")}
              subtitle={t("profile.menu.supportSubtitle")}
              onPress={openSupport}
            />
          </View>

          <View className="flex-1" />

          <Pressable
            className="mx-6 mb-4 mt-8 h-14 items-center justify-center rounded-full border border-white/20"
            onPress={handleSignOut}
          >
            <Text className="font-display text-sm text-flikk-text">
              {t("profile.logout")}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // 4. Default Login View (Unchanged from here down)
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-flikk-dark"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-2">
          <Image
            source={require("@/assets/images/splash-icon.png")}
            className="mb-2 h-[120px] w-[120px] rounded-2xl"
            resizeMode="contain"
          />
          <Text className="font-body text-base text-flikk-text-muted">
            {t("profile.login.tagline")}{" "}
            <Text className="font-display text-flikk-lime">
              {t("profile.login.premium")}
            </Text>
            .
          </Text>
        </View>

        <View className="mt-10 rounded-3xl border border-white/10 bg-flikk-card p-6">
          <View className="mb-6 flex-row rounded-2xl border border-white/10 bg-flikk-dark p-1">
            <Pressable
              className={`h-11 flex-1 items-center justify-center rounded-xl ${
                authMethod === "phone" ? "bg-flikk-lime" : ""
              }`}
              onPress={() => handleSelectAuthMethod("phone")}
            >
              <Text
                className={`font-display text-sm ${
                  authMethod === "phone" ? "text-flikk-dark" : "text-flikk-text"
                }`}
              >
                {t("profile.login.methodPhone")}
              </Text>
            </Pressable>
            <Pressable
              className={`h-11 flex-1 items-center justify-center rounded-xl ${
                authMethod === "email" ? "bg-flikk-lime" : ""
              }`}
              onPress={() => handleSelectAuthMethod("email")}
            >
              <Text
                className={`font-display text-sm ${
                  authMethod === "email" ? "text-flikk-dark" : "text-flikk-text"
                }`}
              >
                {t("profile.login.methodEmail")}
              </Text>
            </Pressable>
          </View>

          {!hasPendingOtpChallenge ? (
            authMethod === "phone" ? (
              <>
                <Text className="font-display text-xl text-flikk-text">
                  {t("profile.login.title")}
                </Text>
                <Text className="mt-2 font-body text-sm leading-5 text-flikk-text-muted">
                  {t("profile.login.subtitle")}
                </Text>

                <View className="mt-6">
                  <Text className="mb-2 font-body text-xs text-flikk-text-muted">
                    {t("profile.login.phoneLabel")}
                  </Text>
                  <View className="h-14 flex-row">
                    <Pressable
                      className="mr-3 min-w-[90px] flex-row items-center justify-center rounded-2xl border border-white/10 bg-flikk-dark px-3"
                      onPress={() => setShowCountryList(!showCountryList)}
                    >
                      <Text className="font-body text-sm text-flikk-text">
                        {COUNTRIES[countryIndex].code}
                      </Text>
                      <Text className="ml-1 font-body text-sm text-flikk-text">
                        {COUNTRIES[countryIndex].dial}
                      </Text>
                      <Feather
                        name="chevron-down"
                        size={14}
                        color="#B3B3B3"
                        style={{ marginLeft: 4 }}
                      />
                    </Pressable>
                    <TextInput
                      className="flex-1 rounded-2xl border border-white/10 bg-flikk-dark px-4 font-body text-base text-flikk-text"
                      placeholder="90 12 34 56"
                      placeholderTextColor="#666666"
                      keyboardType="phone-pad"
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      selectionColor="#CCFF00"
                    />
                  </View>

                  {showCountryList && (
                    <View className="absolute left-0 top-[85px] z-50 w-[220px] rounded-2xl border border-white/10 bg-[#2A2A2A] p-1 shadow-lg">
                      {COUNTRIES.map((country, index) => (
                        <Pressable
                          key={country.code}
                          className={`flex-row items-center justify-between rounded-xl px-4 py-3 ${
                            index === countryIndex ? "bg-white/10" : ""
                          }`}
                          onPress={() => {
                            setCountryIndex(index);
                            setShowCountryList(false);
                          }}
                        >
                          <Text className="font-body text-sm text-flikk-text">
                            {country.code} {country.name}
                          </Text>
                          <Text className="font-body text-xs text-flikk-text-muted">
                            {country.dial}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>

                <Pressable
                  className={`mt-6 h-14 items-center justify-center rounded-full bg-flikk-lime ${
                    !canSendPhoneCode ? "opacity-50" : ""
                  }`}
                  onPress={handleSendCode}
                  disabled={!canSendPhoneCode || isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#121212" />
                  ) : (
                    <Text className="font-display text-base text-flikk-dark">
                      {resendSeconds > 0
                        ? t("profile.login.buttonWait", {
                            seconds: resendSeconds,
                          })
                        : t("profile.login.button")}
                    </Text>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <Text className="font-display text-xl text-flikk-text">
                  {t("profile.login.emailTitle")}
                </Text>
                <Text className="mt-2 font-body text-sm leading-5 text-flikk-text-muted">
                  {t("profile.login.emailSubtitle")}
                </Text>

                <View className="mt-5 flex-row rounded-2xl border border-white/10 bg-flikk-dark p-1">
                  <Pressable
                    className={`h-10 flex-1 items-center justify-center rounded-xl ${
                      emailMode === "login" ? "bg-flikk-lime" : ""
                    }`}
                    onPress={() => handleSelectEmailMode("login")}
                  >
                    <Text
                      className={`font-display text-xs ${
                        emailMode === "login"
                          ? "text-flikk-dark"
                          : "text-flikk-text"
                      }`}
                    >
                      {t("profile.login.emailModeLogin")}
                    </Text>
                  </Pressable>
                  <Pressable
                    className={`h-10 flex-1 items-center justify-center rounded-xl ${
                      emailMode === "signup" ? "bg-flikk-lime" : ""
                    }`}
                    onPress={() => handleSelectEmailMode("signup")}
                  >
                    <Text
                      className={`font-display text-xs ${
                        emailMode === "signup"
                          ? "text-flikk-dark"
                          : "text-flikk-text"
                      }`}
                    >
                      {t("profile.login.emailModeSignup")}
                    </Text>
                  </Pressable>
                  <Pressable
                    className={`h-10 flex-1 items-center justify-center rounded-xl ${
                      emailMode === "otp" ? "bg-flikk-lime" : ""
                    }`}
                    onPress={() => handleSelectEmailMode("otp")}
                  >
                    <Text
                      className={`font-display text-xs ${
                        emailMode === "otp"
                          ? "text-flikk-dark"
                          : "text-flikk-text"
                      }`}
                    >
                      {t("profile.login.emailModeOtp")}
                    </Text>
                  </Pressable>
                </View>

                <View className="mt-6">
                  <Text className="mb-2 font-body text-xs text-flikk-text-muted">
                    {t("profile.login.emailLabel")}
                  </Text>
                  <TextInput
                    className="h-14 rounded-2xl border border-white/10 bg-flikk-dark px-4 font-body text-base text-flikk-text"
                    placeholder="email@example.com"
                    placeholderTextColor="#666666"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={authEmail}
                    onChangeText={setAuthEmail}
                    selectionColor="#CCFF00"
                  />
                </View>

                {emailMode !== "otp" && (
                  <View className="mt-4">
                    <Text className="mb-2 font-body text-xs text-flikk-text-muted">
                      {t("profile.login.passwordLabel")}
                    </Text>
                    <TextInput
                      className="h-14 rounded-2xl border border-white/10 bg-flikk-dark px-4 font-body text-base text-flikk-text"
                      placeholder="******"
                      placeholderTextColor="#666666"
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={authPassword}
                      onChangeText={setAuthPassword}
                      selectionColor="#CCFF00"
                    />
                  </View>
                )}

                {emailMode === "signup" && (
                  <View className="mt-4">
                    <Text className="mb-2 font-body text-xs text-flikk-text-muted">
                      {t("profile.login.passwordConfirmLabel")}
                    </Text>
                    <TextInput
                      className="h-14 rounded-2xl border border-white/10 bg-flikk-dark px-4 font-body text-base text-flikk-text"
                      placeholder="******"
                      placeholderTextColor="#666666"
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={authPasswordConfirm}
                      onChangeText={setAuthPasswordConfirm}
                      selectionColor="#CCFF00"
                    />
                  </View>
                )}

                <Pressable
                  className={`mt-6 h-14 items-center justify-center rounded-full bg-flikk-lime ${
                    (emailMode === "login" && !canSignInWithEmailPassword) ||
                    (emailMode === "signup" && !canSignUpWithEmailPassword) ||
                    (emailMode === "otp" && !canSendEmailOtp)
                      ? "opacity-50"
                      : ""
                  }`}
                  onPress={() => {
                    if (emailMode === "login") {
                      void handleEmailSignIn();
                      return;
                    }
                    if (emailMode === "signup") {
                      void handleEmailSignUp();
                      return;
                    }
                    void handleSendEmailOtp();
                  }}
                  disabled={
                    isLoading ||
                    (emailMode === "login" && !canSignInWithEmailPassword) ||
                    (emailMode === "signup" && !canSignUpWithEmailPassword) ||
                    (emailMode === "otp" && !canSendEmailOtp)
                  }
                >
                  {isLoading ? (
                    <ActivityIndicator color="#121212" />
                  ) : (
                    <Text className="font-display text-base text-flikk-dark">
                      {emailMode === "login"
                        ? t("profile.login.emailSignInButton")
                        : emailMode === "signup"
                          ? t("profile.login.emailSignUpButton")
                          : resendSeconds > 0
                            ? t("profile.login.buttonWait", {
                                seconds: resendSeconds,
                              })
                            : t("profile.login.emailOtpButton")}
                    </Text>
                  )}
                </Pressable>

                {emailMode === "login" && (
                  <Pressable
                    className="mt-4 items-center p-2"
                    onPress={() => {
                      void handleResetPassword();
                    }}
                    disabled={!isAuthEmailValid || isLoading}
                  >
                    <Text
                      className={`font-body text-sm ${
                        !isAuthEmailValid || isLoading
                          ? "text-flikk-text-muted/50"
                          : "text-flikk-text-muted"
                      }`}
                    >
                      {t("profile.login.resetPassword")}
                    </Text>
                  </Pressable>
                )}
              </>
            )
          ) : (
            <>
              <Text className="font-display text-xl text-flikk-text">
                {t("profile.login.verifyTitle")}
              </Text>
              <Text className="mt-2 font-body text-sm leading-5 text-flikk-text-muted">
                {isPendingEmailOtp
                  ? t("profile.login.verifySubtitleEmail", {
                      email: normalizedAuthEmail,
                    })
                  : t("profile.login.verifySubtitle", {
                      phone: `${COUNTRIES[countryIndex].dial} ${phoneNumber}`,
                    })}
              </Text>

              <View className="mt-6">
                <Text className="mb-2 font-body text-xs text-flikk-text-muted">
                  {isPendingEmailOtp
                    ? t("profile.login.codeEmailLabel")
                    : t("profile.login.codeLabel")}
                </Text>
                <TextInput
                  className="h-14 w-full rounded-2xl border border-white/10 bg-flikk-dark px-4 text-center font-body text-2xl tracking-[8px] text-flikk-text"
                  placeholder="000000"
                  placeholderTextColor="#666666"
                  keyboardType="number-pad"
                  value={smsCode}
                  onChangeText={setSmsCode}
                  maxLength={6}
                  selectionColor="#CCFF00"
                  autoFocus
                  textContentType="oneTimeCode"
                  onSubmitEditing={handleConfirmCode}
                />
              </View>

              <Pressable
                className={`mt-6 h-14 items-center justify-center rounded-full bg-flikk-lime ${
                  !canConfirm ? "opacity-50" : ""
                }`}
                onPress={handleConfirmCode}
                disabled={!canConfirm || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#121212" />
                ) : (
                  <Text className="font-display text-base text-flikk-dark">
                    {t("profile.login.confirmButton")}
                  </Text>
                )}
              </Pressable>

              <Pressable className="mt-4 items-center p-4" onPress={resetOtpSession}>
                <Text className="font-body text-sm text-flikk-text-muted">
                  {isPendingEmailOtp
                    ? t("profile.login.changeEmail")
                    : t("profile.login.changeNumber")}
                </Text>
              </Pressable>
            </>
          )}

          {infoMessage && (
            <Text className="mt-4 text-center font-body text-xs text-[#4ADE80]">
              {infoMessage}
            </Text>
          )}
          {errorMessage && (
            <Text className="mt-4 text-center font-body text-xs text-[#FF4D6D]">
              {errorMessage}
            </Text>
          )}
        </View>

        <View className="mb-10 mt-10 gap-4">
          <BenefitItem
            icon="flash-outline"
            text={t("profile.benefits.flash")}
          />
          <BenefitItem
            icon="cube-outline"
            text={t("profile.benefits.delivery")}
          />
          <BenefitItem
            icon="lock-closed-outline"
            text={t("profile.benefits.security")}
          />
        </View>

        <View className="items-center gap-3 pb-4">
          <Pressable onPress={openPolicy}>
            <Text className="font-body text-xs text-flikk-text-muted underline">
              {t("profile.links.privacy")}
            </Text>
          </Pressable>
          <Pressable onPress={openPolicy}>
            <Text className="font-body text-xs text-flikk-text-muted underline">
              {t("profile.links.terms")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function MenuItem({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-3xl bg-white/[0.03] p-4 active:opacity-70"
    >
      <View className="mr-4 h-10 w-10 items-center justify-center rounded-full bg-flikk-lime/10">
        <Ionicons name={icon} size={22} color="#CCFF00" />
      </View>
      <View className="flex-1">
        <Text className="font-display text-base text-flikk-text">{title}</Text>
        <Text className="mt-0.5 font-body text-xs text-[#666666]">
          {subtitle}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color="#666666" />
    </Pressable>
  );
}

function BenefitItem({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View className="flex-row items-center">
      <View className="mr-3 h-8 w-8 items-center justify-center rounded-2xl bg-flikk-lime/10">
        <Ionicons name={icon} size={18} color="#CCFF00" />
      </View>
      <Text className="font-body text-sm text-[#E0E0E0]">{text}</Text>
    </View>
  );
}


