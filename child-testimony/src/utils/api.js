import { Platform } from "react-native";

const API_URL =
  Platform.OS === "web"
    ? "http://localhost:8000"
    : "http://192.168.1.42:8000"; // Replace with your computer's LAN IP

export default API_URL;