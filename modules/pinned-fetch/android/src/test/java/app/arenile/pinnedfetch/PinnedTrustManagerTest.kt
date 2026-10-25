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
  "MIIBSDCB76ADAgECAgkA34QcKL6NR/8wCgYIKoZIzj0EAwIwGDEWMBQGA1UEAwwNYXJlbmlsZS5sb2NhbDAeFw0yNjEwMjUwNzMzMDZaFw0yOTAxMjcwNzMzMDZaMBgxFjAUBgNVBAMMDWFyZW5pbGUubG9jYWwwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAAT0iokM6HFnhFuEWHQyA9djwpxwDjZnP4iiKhwQO5ifSsgZ6JLgxAxWdE1Nvl4nluGdryuNgrcbkZjZ+szF2neXoyIwIDAeBgNVHREEFzAVgg1hcmVuaWxlLmxvY2FshwTAqAEUMAoGCCqGSM49BAMCA0gAMEUCIQDTz52P8wcFerVqi4e5Qpe8Tem4qfexC8ESRO+4DPaukQIgVcnga0evVmI4w4K/ChPXgNrwLILGWhle4q0L8pDg29I="
private const val FINGERPRINT =
  "83:79:BA:75:B9:FC:AB:AE:F7:5B:09:DA:78:A5:B9:68:84:AB:55:74:B8:59:A4:40:4F:7A:0E:A6:CB:A1:2B:4F"

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

    val other = PinnedTrustManager(PinnedFingerprint.parse(FINGERPRINT.replace("83:79", "83:7A"))!!)
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
