import { Redirect } from "expo-router";

export default function App() {
  // Immediately pass the user into the authentication and session checker flow
  return <Redirect href="/signup" />;
}
