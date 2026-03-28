import { useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { Button, Text, TextInput, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const theme = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!isLoaded) return;
    setError(null);
    setLoading(true);

    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      } else {
        setError("Sign-in could not be completed. Please try again.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inner}
      >
        <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.primary }]}>
          LifeKeeper
        </Text>
        <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          Sign in to your account
        </Text>

        <View style={styles.form}>
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            mode="outlined"
            style={styles.input}
          />

          {error ? (
            <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
          ) : null}

          <Button
            mode="contained"
            onPress={handleSignIn}
            loading={loading}
            disabled={loading || !email || !password}
            style={styles.button}
          >
            Sign In
          </Button>

          <Link href="/(auth)/sign-up" asChild>
            <Button mode="text">Create account</Button>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  title: { textAlign: "center", marginBottom: 8, fontWeight: "700" },
  subtitle: { textAlign: "center", marginBottom: 32 },
  form: { gap: 12 },
  input: {},
  error: { fontSize: 13, marginTop: 4 },
  button: { marginTop: 8 },
});
