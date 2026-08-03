import { useState, useEffect } from "react";

function useStickyState<T>(defaultValue: T, key: string): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stickyValue = window.localStorage.getItem(key);
      return stickyValue !== null ? JSON.parse(stickyValue) : defaultValue;
    } catch {
      return defaultValue;
    }
  });
  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue];
}

export function useProfileBasicState() {
  const [fullName, setFullName] = useStickyState("", "profile_draft_fullName");
  const [nickname, setNickname] = useStickyState("", "profile_draft_nickname");
  const [status, setStatus] = useStickyState("looking", "profile_draft_status");
  const [iiscEmail, setIiscEmail] = useStickyState("", "profile_draft_iiscEmail");
  const [contactNumber, setContactNumber] = useStickyState("", "profile_draft_contactNumber");
  const [department, setDepartment] = useStickyState("", "profile_draft_department");
  const [customDepartment, setCustomDepartment] = useStickyState("", "profile_draft_customDepartment");
  const [joinedYear, setJoinedYear] = useStickyState("", "profile_draft_joinedYear");
  const [nationality, setNationality] = useStickyState("", "profile_draft_nationality");
  const [homeState, setHomeState] = useStickyState("", "profile_draft_homeState");
  const [height, setHeight] = useStickyState("", "profile_draft_height");
  const [instagram, setInstagram] = useStickyState("", "profile_draft_instagram");
  const [avatarUrl, setAvatarUrl] = useStickyState("", "profile_draft_avatarUrl");
  const [gender, setGender] = useStickyState("", "profile_draft_gender");
  const [isGuest, setIsGuest] = useStickyState(false, "profile_draft_isGuest");
  const [isRetired, setIsRetired] = useStickyState(false, "profile_draft_isRetired");

  return {
    fullName, setFullName, nickname, setNickname, status, setStatus, iiscEmail, setIiscEmail,
    contactNumber, setContactNumber, department, setDepartment, customDepartment, setCustomDepartment,
    joinedYear, setJoinedYear, nationality, setNationality, homeState, setHomeState, height, setHeight,
    instagram, setInstagram, avatarUrl, setAvatarUrl, gender, setGender, isGuest, setIsGuest,
    isRetired, setIsRetired,
  };
}
