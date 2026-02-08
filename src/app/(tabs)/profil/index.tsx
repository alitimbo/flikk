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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { FirebaseAuthTypes } from "@react-native-firebase/auth";
import { FirebaseService } from "@/services/firebase/firebase-service";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { MediaPicker } from "@/components/ui/MediaPicker";
import { useUserProfile } from "@/hooks/useUserProfile";

export default function ProfilIndex() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [authUser, setAuthUser] = useState<FirebaseAuthTypes.User | null>(null);

  // Login State
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [confirmation, setConfirmation] =
    useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [countryIndex, setCountryIndex] = useState(0);
  const [showCountryList, setShowCountryList] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const resendTimer = useRef<NodeJS.Timeout | null>(null);

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
    const unsubscribe = FirebaseService.auth.onAuthStateChanged((user) => {
      setAuthUser(user);
    });
    return unsubscribe;
  }, []);

  // Pre-fill form if data exists (for editing later, though currently we only show on incomplete)
  useEffect(() => {
    if (userProfile) {
      setFirstName(userProfile.firstName || "");
      setLastName(userProfile.lastName || "");
      setEmail(userProfile.email || "");
      setIsMerchant(userProfile.isMerchant || false);
      if (userProfile.merchantInfo) {
        setBusinessName(userProfile.merchantInfo.businessName || "");
        setTaxId(userProfile.merchantInfo.taxId || "");
        setAddress(userProfile.merchantInfo.address || "");
        setBusinessPhone(userProfile.merchantInfo.businessPhone || "");
        setLogoUri(userProfile.merchantInfo.logoUrl || null);
      }
    }
  }, [userProfile]);

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
    } catch {
      console.log("Error sending code");
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
    } catch {
      setErrorMessage(t("profile.login.errorCode"));
    } finally {
      setIsLoading(false);
    }
  }, [canConfirm, confirmation, smsCode, t]);

  const handleSignOut = useCallback(async () => {
    await FirebaseService.auth.signOut();
  }, []);

  const handleSaveProfile = async () => {
    if (!authUser || !firstName || !lastName) return;

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
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
          style={{ paddingTop: insets.top }}
        >
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

              <View className="mt-4 flex-row items-center justify-between rounded-2xl border border-white/10 bg-flikk-card p-4">
                <Text className="font-display text-base text-flikk-text">
                  {t("profile.completion.isMerchant")}
                </Text>
                <Switch
                  value={isMerchant}
                  onValueChange={setIsMerchant}
                  trackColor={{ false: "#1E1E1E", true: "#CCFF00" }}
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

                  <TextInput
                    className="h-14 w-full rounded-2xl border border-white/10 bg-flikk-card px-4 font-body text-base text-flikk-text"
                    placeholder={t("profile.completion.businessName")}
                    placeholderTextColor="#666666"
                    value={businessName}
                    onChangeText={setBusinessName}
                  />
                  <TextInput
                    className="h-14 w-full rounded-2xl border border-white/10 bg-flikk-card px-4 font-body text-base text-flikk-text"
                    placeholder={t("profile.completion.taxId")}
                    placeholderTextColor="#666666"
                    value={taxId}
                    onChangeText={setTaxId}
                  />
                  <TextInput
                    className="h-14 w-full rounded-2xl border border-white/10 bg-flikk-card px-4 font-body text-base text-flikk-text"
                    placeholder={t("profile.completion.address")}
                    placeholderTextColor="#666666"
                    value={address}
                    onChangeText={setAddress}
                  />
                  <TextInput
                    className="h-14 w-full rounded-2xl border border-white/10 bg-flikk-card px-4 font-body text-base text-flikk-text"
                    placeholder={t("profile.completion.businessPhone")}
                    placeholderTextColor="#666666"
                    value={businessPhone}
                    onChangeText={setBusinessPhone}
                    keyboardType="phone-pad"
                  />
                </View>
              )}

              <Pressable
                className={`mt-6 h-14 items-center justify-center rounded-full bg-flikk-lime ${
                  !firstName || !lastName ? "opacity-50" : ""
                }`}
                onPress={handleSaveProfile}
                disabled={!firstName || !lastName || isUpdating}
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

          <MediaPicker
            isVisible={showMediaPicker}
            onClose={() => setShowMediaPicker(false)}
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
          <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
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
                {userProfile?.phoneNumber || authUser.phoneNumber}
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
            />

            {/* 3. Favoris */}
            <MenuItem
              icon="heart-outline"
              title={t("profile.menu.favorites")}
              subtitle={t("profile.menu.favoritesSubtitle")}
            />

            {/* 4. Adresses */}
            <MenuItem
              icon="location-outline"
              title={t("profile.menu.addresses")}
              subtitle={t("profile.menu.addressesSubtitle")}
            />

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
