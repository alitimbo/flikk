import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserService } from "@/services/firebase/user-service";
import { UserProfile } from "@/types";

export function useUserProfile(uid: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["userProfile", uid],
    queryFn: () => (uid ? UserService.getUser(uid) : null),
    enabled: !!uid,
  });

  const mutation = useMutation({
    mutationFn: async (data: Partial<UserProfile>) => {
      if (!uid) throw new Error("No user ID");
      await UserService.createOrUpdateUser(uid, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userProfile", uid] });
    },
  });

  const uploadLogoMutation = useMutation({
    mutationFn: async (uri: string) => {
      if (!uid) throw new Error("No user ID");
      return await UserService.uploadLogo(uid, uri);
    },
  });

  return {
    ...query,
    updateProfile: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    uploadLogo: uploadLogoMutation.mutateAsync,
    isUploading: uploadLogoMutation.isPending,
  };
}
