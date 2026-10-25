import Foundation
import Security
import Testing

@testable import PinnedFingerprint

private let sample = Data("arenile".utf8)

// Self-signed ECDSA P-256 certificate (CN=arenile.local, SAN 192.168.1.20) and
// its fingerprint as printed by `openssl x509 -fingerprint -sha256`, which is
// the format of the core's desktop.Fingerprint.
private let certificateDER = Data(base64Encoded: "MIIBSDCB76ADAgECAgkA34QcKL6NR/8wCgYIKoZIzj0EAwIwGDEWMBQGA1UEAwwNYXJlbmlsZS5sb2NhbDAeFw0yNjEwMjUwNzMzMDZaFw0yOTAxMjcwNzMzMDZaMBgxFjAUBgNVBAMMDWFyZW5pbGUubG9jYWwwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAAT0iokM6HFnhFuEWHQyA9djwpxwDjZnP4iiKhwQO5ifSsgZ6JLgxAxWdE1Nvl4nluGdryuNgrcbkZjZ+szF2neXoyIwIDAeBgNVHREEFzAVgg1hcmVuaWxlLmxvY2FshwTAqAEUMAoGCCqGSM49BAMCA0gAMEUCIQDTz52P8wcFerVqi4e5Qpe8Tem4qfexC8ESRO+4DPaukQIgVcnga0evVmI4w4K/ChPXgNrwLILGWhle4q0L8pDg29I=")!
private let certificateFingerprint =
  "83:79:BA:75:B9:FC:AB:AE:F7:5B:09:DA:78:A5:B9:68:84:AB:55:74:B8:59:A4:40:4F:7A:0E:A6:CB:A1:2B:4F"

private func canonical(_ digest: Data) -> String {
  digest.map { String(format: "%02X", $0) }.joined(separator: ":")
}

@Test func parsesCanonicalPlainAndLowerCase() throws {
  let digest = PinnedFingerprint.sha256(sample)
  let colon = canonical(digest)
  #expect(PinnedFingerprint.parse(colon) == digest)
  #expect(PinnedFingerprint.parse(colon.lowercased()) == digest)
  #expect(PinnedFingerprint.parse(colon.replacingOccurrences(of: ":", with: "")) == digest)
  #expect(PinnedFingerprint.parse("  \(colon)\n") == digest)
}

@Test(arguments: ["", "AA:BB", String(repeating: "A", count: 62), String(repeating: "G", count: 64), String(repeating: "A", count: 66)])
func rejectsMalformed(_ value: String) {
  #expect(PinnedFingerprint.parse(value) == nil)
}

@Test func matchesOnlyTheExactCertificate() throws {
  let expected = try #require(PinnedFingerprint.parse(canonical(PinnedFingerprint.sha256(sample))))
  #expect(PinnedFingerprint.matches(certificate: sample, expected: expected))
  #expect(!PinnedFingerprint.matches(certificate: Data("arenilf".utf8), expected: expected))
  #expect(!PinnedFingerprint.matches(certificate: Data(), expected: expected))
}

@Test func matchesTheFingerprintOfARealCertificate() throws {
  let expected = try #require(PinnedFingerprint.parse(certificateFingerprint))
  #expect(PinnedFingerprint.matches(certificate: certificateDER, expected: expected))
  var tampered = certificateDER
  tampered[tampered.count - 1] ^= 0x01
  #expect(!PinnedFingerprint.matches(certificate: tampered, expected: expected))
}

/// A SecTrust holding the fixture certificate, like the one URLSession hands to the delegate.
private func fixtureTrust() -> SecTrust? {
  guard let certificate = SecCertificateCreateWithData(nil, certificateDER as CFData) else { return nil }
  var trust: SecTrust?
  let policy = SecPolicyCreateSSL(true, "192.168.1.20" as CFString)
  guard SecTrustCreateWithCertificates(certificate, policy, &trust) == errSecSuccess else { return nil }
  return trust
}

@Test func extractsTheLeafCertificateFromATrust() throws {
  let trust = try #require(fixtureTrust())
  #expect(PinnedFingerprint.leafCertificate(of: trust) == certificateDER)
}

@Test func constantTimeEqualsComparesLengthAndBytes() {
  #expect(PinnedFingerprint.constantTimeEquals(Data([1, 2, 3]), Data([1, 2, 3])))
  #expect(!PinnedFingerprint.constantTimeEquals(Data([1, 2, 3]), Data([1, 2, 4])))
  #expect(!PinnedFingerprint.constantTimeEquals(Data([1, 2, 3]), Data([1, 2])))
}
