import { useSignUp } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { Button, Text, TextInput, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const theme = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!isLoaded) return;
    setError(null);
    setLoading(true);

    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded) return;
    setError(null);
    setLoading(true);

    try {
      const result = await signUp.attemptEmailAddressVerification({ code: verificationCode });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      } else {
        setError("Verification failed. Please check the code and try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
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
          Create Account
        </Text>

        {!pendingVerification ? (
          <View style={styles.form}>
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              mode="outlined"
            />
            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="newPassword"
              mode="outlined"
            />
            {error ? (
              <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
            ) : null}
            <Button
              mode="contained"
              onPress={handleSignUp}
              loading={loading}
              disabled={loading || !email || !password}
              style={styles.button}
            >
              Continue
            </Button>
            <Link href="/(auth)/sign-in" asChild>
              <Button mode="text">Already have an account?</Button>
            </Link>
          </View>
        ) : (
          <View style={styles.form}>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}
            >
              Enter the verification code sent to {email}
            </Text>
            <TextInput
              label="Verification code"
              value={verificationCode}
              onChangeText={setVerificationCode}
              keyboardType="number-pad"
              mode="outlined"
            />
            {error ? (
              <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
            ) : null}
            <Button
              mode="contained"
              onPress={handleVerify}
              loading={loading}
              disabled={loading || !verificationCode}
              style={styles.button}
            >
              Verify Email
            </Button>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  title: { textAlign: "center", marginBottom: 32, fontWeight: "700" },
  form: { gap: 12 },
  error: { fontSize: 13, marginTop: 4 },
  button: { marginTop: 8 },
});
