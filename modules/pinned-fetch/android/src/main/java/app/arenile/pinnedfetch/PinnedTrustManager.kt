package app.arenile.pinnedfetch

import java.security.cert.CertificateException
import java.security.cert.X509Certificate
import javax.net.ssl.X509TrustManager

/** The leaf certificate is not the one pinned at pairing (renewed certificate, or another server). */
internal class FingerprintMismatchException : CertificateException("certificate fingerprint mismatch")

/**
 * Trusts exactly one certificate: the leaf whose SHA-256 equals [expected].
 * Used ONLY by the dedicated OkHttpClient of the pinned transport (ADR 0006);
 * the rest of the app keeps the system trust store.
 */
internal class PinnedTrustManager(private val expected: ByteArray) : X509TrustManager {
  override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {
    throw CertificateException("client certificates are not accepted")
  }

  override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {
    val leaf = chain?.firstOrNull() ?: throw FingerprintMismatchException()
    if (!PinnedFingerprint.matches(leaf.encoded, expected)) throw FingerprintMismatchException()
  }

  override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
}
