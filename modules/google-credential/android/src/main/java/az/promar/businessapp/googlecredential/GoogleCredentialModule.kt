package az.promar.businessapp.googlecredential

import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Opens the Android Credential Manager "Sign in with Google" bottom sheet and
 * returns the Google ID token. The token is verified by the Cloudflare Worker,
 * which applies the pending/accepted user status.
 */
class GoogleCredentialModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("GoogleCredential")

    AsyncFunction("signIn") Coroutine { serverClientId: String ->
      val activity = appContext.currentActivity
        ?: throw CodedException(
          "ERR_NO_ACTIVITY",
          "Google giriş pəncərəsi üçün aktiv ekran tapılmadı.",
          null
        )

      val request = GetCredentialRequest.Builder()
        .addCredentialOption(
          GetGoogleIdOption.Builder()
            // Show every Google account on the device, not only previously
            // authorized ones. Combined with auto-select disabled, Credential
            // Manager always opens the account picker bottom sheet.
            .setFilterByAuthorizedAccounts(false)
            .setServerClientId(serverClientId)
            .setAutoSelectEnabled(false)
            .build()
        )
        .build()

      try {
        val response = CredentialManager.create(activity).getCredential(activity, request)
        val credential = response.credential

        if (
          credential is CustomCredential &&
          credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
        ) {
          GoogleIdTokenCredential.createFrom(credential.data).idToken
        } else {
          throw CodedException(
            "ERR_UNEXPECTED_CREDENTIAL",
            "Gözlənilməyən Google cavabı alındı.",
            null
          )
        }
      } catch (error: GetCredentialCancellationException) {
        throw CodedException("SIGN_IN_CANCELLED", "Google girişi ləğv edildi.", error)
      } catch (error: NoCredentialException) {
        throw CodedException(
          "NO_CREDENTIAL",
          "Cihazda Google hesabı tapılmadı. Telefonun ayarlarına Gmail hesabı əlavə edin.",
          error
        )
      } catch (error: GetCredentialException) {
        throw CodedException(
          "GOOGLE_CREDENTIAL_ERROR",
          error.message ?: "Google girişi alınmadı.",
          error
        )
      } catch (error: GoogleIdTokenParsingException) {
        throw CodedException(
          "GOOGLE_TOKEN_PARSE_ERROR",
          "Google ID token oxunmadı.",
          error
        )
      }
    }
  }
}
