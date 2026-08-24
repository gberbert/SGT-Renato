import React from "react";
import PermissionsManager from "../components/PermissionsManager";

export default function SecopsPermissionsLayout({ userRole = "user" }) {
  // Proteção mínima: só admin acessa
  if (userRole !== "admin") return null;

  return <PermissionsManager initialProfileId="admin" />;
}
