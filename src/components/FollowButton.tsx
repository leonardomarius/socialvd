"use client";

import { useEffect, useState } from "react";
import { followUser, unfollowUser, isFollowing } from "@/lib/follow";

export default function FollowButton({ profileId }: { profileId: string }) {
  const userId =
    typeof window !== "undefined" ? localStorage.getItem("user_id") : null;

  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    (async () => {
      const { isFollowing: f } = await isFollowing(userId, profileId);
      setFollowing(f);
      setLoading(false);
    })();
  }, [userId, profileId]);

  async function toggleFollow() {
    if (!userId) return;

    if (following) {
      await unfollowUser(userId, profileId);
      setFollowing(false);
    } else {
      await followUser(userId, profileId);
      setFollowing(true);
    }
  }

  if (loading) return null;

  if (userId === profileId) return null; // Can't follow yourself

  return (
    <button
      onClick={toggleFollow}
      className={`px-4 py-2 rounded font-semibold ${
        following
          ? "bg-gray-300 text-black"
          : "bg-blue-600 text-white hover:bg-blue-700"
      }`}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
