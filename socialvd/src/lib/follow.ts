import { supabase } from "@/lib/supabase";

// FOLLOW
export async function followUser(follower_id: string, following_id: string) {
  const { error } = await supabase
    .from("follows")
    .insert([{ follower_id, following_id }]);

  return { error };
}

// UNFOLLOW
export async function unfollowUser(follower_id: string, following_id: string) {
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", follower_id)
    .eq("following_id", following_id);

  return { error };
}

// CHECK EXISTING FOLLOW
export async function isFollowing(follower_id: string, following_id: string) {
  const { data, error } = await supabase
    .from("follows")
    .select("*")
    .eq("follower_id", follower_id)
    .eq("following_id", following_id)
    .maybeSingle();

  return { isFollowing: !!data, error };
}

// COUNT FOLLOWERS (people who follow THIS user)
export async function getFollowersCount(userId: string) {
  const { count } = await supabase
    .from("follows")
    .select("*", { head: true, count: "exact" })
    .eq("following_id", userId);

  return count ?? 0;
}

// COUNT FOLLOWING (people THIS user follows)
export async function getFollowingCount(userId: string) {
  const { count } = await supabase
    .from("follows")
    .select("*", { head: true, count: "exact" })
    .eq("follower_id", userId);

  return count ?? 0;
}
