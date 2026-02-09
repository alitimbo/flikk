import { getFunctions, httpsCallable } from "@react-native-firebase/functions";

type IncrementViewResponse = {
  counted: boolean;
};

export class ViewService {
  private static functions = getFunctions(undefined, "us-central1");

  static async incrementViewOnce(
    publicationId: string,
    deviceId: string,
  ): Promise<boolean> {
    const call = httpsCallable<
      { publicationId: string; deviceId: string },
      IncrementViewResponse
    >(this.functions, "incrementViewOnce");

    const result = await call({ publicationId, deviceId });
    return Boolean(result?.data?.counted);
  }
}
