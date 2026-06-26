import { useState } from "react";

export function useProfileBasicState() {
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [status, setStatus] = useState("looking");
  const [iiscEmail, setIiscEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [department, setDepartment] = useState("");
  const [customDepartment, setCustomDepartment] = useState("");
  const [joinedYear, setJoinedYear] = useState("");
  const [nationality, setNationality] = useState("");
  const [homeState, setHomeState] = useState("");
  const [height, setHeight] = useState("");
  const [instagram, setInstagram] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [gender, setGender] = useState("");
  const [isGuest, setIsGuest] = useState(false);
  const [isRetired, setIsRetired] = useState(false);

  return {
    fullName, setFullName, nickname, setNickname, status, setStatus, iiscEmail, setIiscEmail,
    contactNumber, setContactNumber, department, setDepartment, customDepartment, setCustomDepartment,
    joinedYear, setJoinedYear, nationality, setNationality, homeState, setHomeState, height, setHeight,
    instagram, setInstagram, avatarUrl, setAvatarUrl, gender, setGender, isGuest, setIsGuest,
    isRetired, setIsRetired,
  };
}
