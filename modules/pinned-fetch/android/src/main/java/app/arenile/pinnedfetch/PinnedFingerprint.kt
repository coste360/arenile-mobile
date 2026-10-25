package app.arenile.pinnedfetch

import java.security.MessageDigest

/** Fingerprint primitives of the pinned transport (ADR 0006); pure JVM code. */
internal object PinnedFingerprint {
  /** Parses a SHA-256 fingerprint (`AA:BB:…` or 64 hex digits, any case) into its 32 bytes. */
  fun parse(value: String): ByteArray? {
    val hex = value.trim().replace(":", "")
    if (hex.length != 64) return null
    val bytes = ByteArray(32)
    for (i in bytes.indices) {
      val high = nibble(hex[2 * i]) ?: return null
      val low = nibble(hex[2 * i + 1]) ?: return null
      bytes[i] = ((high shl 4) or low).toByte()
    }
    return bytes
  }

  fun sha256(der: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(der)

  /** True when the SHA-256 of [der] equals [expected]; MessageDigest.isEqual runs in constant time. */
  fun matches(der: ByteArray, expected: ByteArray): Boolean = MessageDigest.isEqual(sha256(der), expected)

  private fun nibble(c: Char): Int? = when (c) {
    in '0'..'9' -> c - '0'
    in 'a'..'f' -> c - 'a' + 10
    in 'A'..'F' -> c - 'A' + 10
    else -> null
  }
}
