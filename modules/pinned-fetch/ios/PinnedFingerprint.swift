// Fingerprint primitives of the pinned transport (ADR 0006). No dependency on
// ExpoModulesCore, so that they can be compiled and tested on their own.
import CryptoKit
import Foundation
import Security

enum PinnedFingerprint {
  /// Parses a SHA-256 fingerprint (`AA:BB:…` or 64 hex digits, any case) into its 32 bytes.
  static func parse(_ value: String) -> Data? {
    let hex = value.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ":", with: "")
    let digits = Array(hex.utf8)
    guard digits.count == 64 else { return nil }
    var bytes = Data(capacity: 32)
    var index = 0
    while index < digits.count {
      guard let high = nibble(digits[index]), let low = nibble(digits[index + 1]) else { return nil }
      bytes.append(high << 4 | low)
      index += 2
    }
    return bytes
  }

  /// SHA-256 of a certificate in DER.
  static func sha256(_ der: Data) -> Data {
    Data(SHA256.hash(data: der))
  }

  /// Compares two byte strings in time that depends only on their length.
  static func constantTimeEquals(_ lhs: Data, _ rhs: Data) -> Bool {
    guard lhs.count == rhs.count else { return false }
    var difference: UInt8 = 0
    for (a, b) in zip(lhs, rhs) {
      difference |= a ^ b
    }
    return difference == 0
  }

  /// True when the SHA-256 of `der` equals the expected fingerprint bytes.
  static func matches(certificate der: Data, expected: Data) -> Bool {
    constantTimeEquals(sha256(der), expected)
  }

  /// DER bytes of the leaf (server) certificate presented in a TLS handshake.
  static func leafCertificate(of trust: SecTrust) -> Data? {
    guard let chain = SecTrustCopyCertificateChain(trust) as? [SecCertificate], let leaf = chain.first else {
      return nil
    }
    return SecCertificateCopyData(leaf) as Data
  }

  private static func nibble(_ c: UInt8) -> UInt8? {
    switch c {
    case UInt8(ascii: "0")...UInt8(ascii: "9"): return c - UInt8(ascii: "0")
    case UInt8(ascii: "a")...UInt8(ascii: "f"): return c - UInt8(ascii: "a") + 10
    case UInt8(ascii: "A")...UInt8(ascii: "F"): return c - UInt8(ascii: "A") + 10
    default: return nil
    }
  }
}
