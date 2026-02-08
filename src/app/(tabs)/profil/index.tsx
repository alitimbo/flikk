import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { FirebaseAuthTypes } from "@react-native-firebase/auth";
import { FirebaseService } from "@/services/firebase/firebase-service";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

export default function ProfilIndex() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [authUser, setAuthUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [confirmation, setConfirmation] =
    useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [countryIndex, setCountryIndex] = useState(0);
  const [showCountryList, setShowCountryList] = useState(false);
  const resendTimer = useRef<NodeJS.Timeout | null>(null);

  const COUNTRIES = useMemo(
    () => [
      { code: "NE", name: "Niger", dial: "+227" },
      { code: "ML", name: "Mali", dial: "+223" },
    ],
    [],
  );

  useEffect(() => {
    const unsubscribe = FirebaseService.auth.onAuthStateChanged((user) => {
      setAuthUser(user);
    });
    return unsubscribe;
  }, []);

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

  const canSendCode = useMemo(
    () => phoneNumber.trim().length >= 8 && resendSeconds === 0,
    [phoneNumber, resendSeconds],
  );
  const canConfirm = useMemo(() => smsCode.trim().length >= 4, [smsCode]);

  const handleSendCode = useCallback(async () => {
    setErrorMessage(null);
    if (!canSendCode) return;
    try {
      setIsLoading(true);
      const fullPhone = `${COUNTRIES[countryIndex].dial}${phoneNumber.trim()}`;
      const result =
        await FirebaseService.auth.signInWithPhoneNumber(fullPhone);
      setConfirmation(result);
      setResendSeconds(30);
    } catch (_error) {
      console.log(_error);
      setErrorMessage(t("profile.login.errorSend"));
    } finally {
      setIsLoading(false);
    }
  }, [canSendCode, phoneNumber, countryIndex, COUNTRIES, t]);

  const handleConfirmCode = useCallback(async () => {
    if (!confirmation || !canConfirm) return;
    try {
      setIsLoading(true);
      await confirmation.confirm(smsCode.trim());
      setSmsCode("");
    } catch (_error) {
      setErrorMessage(t("profile.login.errorCode"));
    } finally {
      setIsLoading(false);
    }
  }, [canConfirm, confirmation, smsCode, t]);

  const handleSignOut = useCallback(async () => {
    await FirebaseService.auth.signOut();
  }, []);

  if (authUser) {
    return (
      <View
        className="flex-1 bg-flikk-dark"
        style={{ paddingTop: insets.top + 24 }}
      >
        <View className="mb-8 flex-row items-center justify-between px-6">
          <Text className="font-display text-3xl text-flikk-text">
            {t("profile.title")}
          </Text>
          <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          <View className="mx-6 flex-row items-center rounded-3xl border border-white/10 bg-flikk-card p-5">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-flikk-lime">
              <Text className="font-display text-2xl text-flikk-dark">
                {authUser.phoneNumber?.slice(-2) ?? "ME"}
              </Text>
            </View>
            <View className="ml-4 flex-1">
              <Text className="font-display text-lg text-flikk-text">
                {t("profile.memberType")}
              </Text>
              <Text className="mt-1 font-body text-sm text-flikk-text-muted">
                {authUser.phoneNumber ?? t("profile.memberSubtitle")}
              </Text>
            </View>
          </View>

          <View className="mt-8 gap-4 px-6">
            <MenuItem
              icon="cube-outline"
              title={t("profile.menu.orders")}
              subtitle={t("profile.menu.ordersSubtitle")}
            />
            <MenuItem
              icon="heart-outline"
              title={t("profile.menu.favorites")}
              subtitle={t("profile.menu.favoritesSubtitle")}
            />
            <MenuItem
              icon="location-outline"
              title={t("profile.menu.addresses")}
              subtitle={t("profile.menu.addressesSubtitle")}
            />
            <MenuItem
              icon="help-circle-outline"
              title={t("profile.menu.support")}
              subtitle={t("profile.menu.supportSubtitle")}
            />
          </View>

          <Pressable
            className="mx-6 mb-10 mt-auto h-14 items-center justify-center rounded-full border border-white/20"
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
          {!confirmation ? (
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
                    <Text className="mr-1 text-base">
                      {COUNTRIES[countryIndex].code === "NE" ? "🇳🇪" : "🇲🇱"}
                    </Text>
                    <Text className="font-body text-sm text-flikk-text">
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
                  <View className="absolute left-0 top-[85px] z-50 w-[200px] rounded-2xl border border-white/10 bg-[#2A2A2A] p-1 shadow-lg">
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
                          {country.code === "NE" ? "🇳🇪" : "🇲🇱"} {country.name}
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
                  !canSendCode ? "opacity-50" : ""
                }`}
                onPress={handleSendCode}
                disabled={!canSendCode || isLoading}
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
                {t("profile.login.verifyTitle")}
              </Text>
              <Text className="mt-2 font-body text-sm leading-5 text-flikk-text-muted">
                {t("profile.login.verifySubtitle", {
                  phone: `${COUNTRIES[countryIndex].dial} ${phoneNumber}`,
                })}
              </Text>

              <View className="mt-6">
                <Text className="mb-2 font-body text-xs text-flikk-text-muted">
                  {t("profile.login.codeLabel")}
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

              <Pressable
                className="mt-4 items-center p-4"
                onPress={() => {
                  setConfirmation(null);
                  setSmsCode("");
                }}
              >
                <Text className="font-body text-sm text-flikk-text-muted">
                  {t("profile.login.changeNumber")}
                </Text>
              </Pressable>
            </>
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function MenuItem({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <Pressable className="flex-row items-center rounded-3xl bg-white/[0.03] p-4">
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
