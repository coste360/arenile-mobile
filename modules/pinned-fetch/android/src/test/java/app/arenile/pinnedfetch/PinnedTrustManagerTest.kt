package app.arenile.pinnedfetch

import java.io.ByteArrayInputStream
import java.security.cert.CertificateException
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import java.util.Base64
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

// Self-signed ECDSA P-256 certificate (CN=arenile.local, SAN 192.168.1.20) and
// its fingerprint as printed by `openssl x509 -fingerprint -sha256` (the
// format of the core's desktop.Fingerprint). Same fixture as the Swift tests.
private const val CERTIFICATE =
  "MIICPTCCAeOgAwIBAgIJANsV+ovT7iwAMAoGCCqGSM49BAMCMBgxFjAUBgNVBAMMDWFyZW5pbGUubG9jYWwwHhcNMjYxMDI1MDcyMTU5WhcNMjkwMTI3MDcyMTU5WjAYMRYwFAYDVQQDDA1hcmVuaWxlLmxvY2FsMIIBSzCCAQMGByqGSM49AgEwgfcCAQEwLAYHKoZIzj0BAQIhAP////8AAAABAAAAAAAAAAAAAAAA////////////////MFsEIP////8AAAABAAAAAAAAAAAAAAAA///////////////8BCBaxjXYqjqT57PrvVV2mIa8ZR0GsMxTsPY7zjw+J9JgSwMVAMSdNgiG5wSTamZ44ROdJreBn36QBEEEaxfR8uEsQkf4vOblY6RA8ncDfYEt6zOg9KE5RdiYwpZP40Li/hp/m47n60p8D54WK84zV2sxXs7LtkBoN79R9QIhAP////8AAAAA//////////+85vqtpxeehPO5ysL8YyVRAgEBA0IABJdK2wv2H9IUr0RCVkeYoQBOxU9cjDxwIbsBBxSJjI1pPDtFI82IFzTM8ZfM7+m0SiBBnN1NRGs5XslboQrS+bajIjAgMB4GA1UdEQQXMBWCDWFyZW5pbGUubG9jYWyHBMCoARQwCgYIKoZIzj0EAwIDSAAwRQIhANyJILAyfKnzd+ch/2mzaW+lz0HM8lYRNJPp1uPgdKXlAiB9eYxqDHgGKVYK+AZQuZyFCGM/mwzGb/gxrJlsQmmXkw=="
private const val FINGERPRINT =
  "83:A9:D2:70:46:86:36:88:87:C6:F1:DE:C5:48:09:77:90:72:ED:6D:FC:BD:49:D5:D0:A8:FD:B8:F4:B2:09:7D"

class PinnedTrustManagerTest {
  private val certificate: X509Certificate =
    CertificateFactory.getInstance("X.509")
      .generateCertificate(ByteArrayInputStream(Base64.getDecoder().decode(CERTIFICATE))) as X509Certificate

  @Test
  fun parsesCanonicalPlainAndLowerCaseFingerprints() {
    val expected = PinnedFingerprint.parse(FINGERPRINT)!!
    assertArrayEquals(expected, PinnedFingerprint.parse(FINGERPRINT.lowercase()))
    assertArrayEquals(expected, PinnedFingerprint.parse(FINGERPRINT.replace(":", "")))
    assertArrayEquals(expected, PinnedFingerprint.parse("  $FINGERPRINT\n"))
  }

  @Test
  fun rejectsMalformedFingerprints() {
    listOf("", "AA:BB", "A".repeat(62), "G".repeat(64), "A".repeat(66), "０".repeat(64)).forEach {
      assertNull(it, PinnedFingerprint.parse(it))
    }
  }

  @Test
  fun matchesOnlyTheExactCertificate() {
    val expected = PinnedFingerprint.parse(FINGERPRINT)!!
    assertTrue(PinnedFingerprint.matches(certificate.encoded, expected))
    val tampered = certificate.encoded.also { it[it.size - 1] = (it[it.size - 1].toInt() xor 1).toByte() }
    assertFalse(PinnedFingerprint.matches(tampered, expected))
  }

  @Test
  fun trustsThePinnedLeafOnly() {
    val manager = PinnedTrustManager(PinnedFingerprint.parse(FINGERPRINT)!!)
    manager.checkServerTrusted(arrayOf(certificate), "ECDHE_ECDSA")

    val other = PinnedTrustManager(PinnedFingerprint.parse(FINGERPRINT.replace("83:A9", "83:AA"))!!)
    assertThrows(FingerprintMismatchException::class.java) {
      other.checkServerTrusted(arrayOf(certificate), "ECDHE_ECDSA")
    }
    assertThrows(FingerprintMismatchException::class.java) {
      manager.checkServerTrusted(arrayOf(), "ECDHE_ECDSA")
    }
    assertThrows(CertificateException::class.java) {
      manager.checkClientTrusted(arrayOf(certificate), "ECDHE_ECDSA")
    }
    assertTrue(manager.acceptedIssuers.isEmpty())
  }
}
