import Foundation
import Testing

@testable import PinnedFingerprint

private let sample = Data("arenile".utf8)

// Self-signed ECDSA P-256 certificate (CN=arenile.local, SAN 192.168.1.20) and
// its fingerprint as printed by `openssl x509 -fingerprint -sha256`, which is
// the format of the core's desktop.Fingerprint.
private let certificateDER = Data(base64Encoded: "MIICPTCCAeOgAwIBAgIJANsV+ovT7iwAMAoGCCqGSM49BAMCMBgxFjAUBgNVBAMMDWFyZW5pbGUubG9jYWwwHhcNMjYxMDI1MDcyMTU5WhcNMjkwMTI3MDcyMTU5WjAYMRYwFAYDVQQDDA1hcmVuaWxlLmxvY2FsMIIBSzCCAQMGByqGSM49AgEwgfcCAQEwLAYHKoZIzj0BAQIhAP////8AAAABAAAAAAAAAAAAAAAA////////////////MFsEIP////8AAAABAAAAAAAAAAAAAAAA///////////////8BCBaxjXYqjqT57PrvVV2mIa8ZR0GsMxTsPY7zjw+J9JgSwMVAMSdNgiG5wSTamZ44ROdJreBn36QBEEEaxfR8uEsQkf4vOblY6RA8ncDfYEt6zOg9KE5RdiYwpZP40Li/hp/m47n60p8D54WK84zV2sxXs7LtkBoN79R9QIhAP////8AAAAA//////////+85vqtpxeehPO5ysL8YyVRAgEBA0IABJdK2wv2H9IUr0RCVkeYoQBOxU9cjDxwIbsBBxSJjI1pPDtFI82IFzTM8ZfM7+m0SiBBnN1NRGs5XslboQrS+bajIjAgMB4GA1UdEQQXMBWCDWFyZW5pbGUubG9jYWyHBMCoARQwCgYIKoZIzj0EAwIDSAAwRQIhANyJILAyfKnzd+ch/2mzaW+lz0HM8lYRNJPp1uPgdKXlAiB9eYxqDHgGKVYK+AZQuZyFCGM/mwzGb/gxrJlsQmmXkw==")!
private let certificateFingerprint =
  "83:A9:D2:70:46:86:36:88:87:C6:F1:DE:C5:48:09:77:90:72:ED:6D:FC:BD:49:D5:D0:A8:FD:B8:F4:B2:09:7D"

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

@Test func constantTimeEqualsComparesLengthAndBytes() {
  #expect(PinnedFingerprint.constantTimeEquals(Data([1, 2, 3]), Data([1, 2, 3])))
  #expect(!PinnedFingerprint.constantTimeEquals(Data([1, 2, 3]), Data([1, 2, 4])))
  #expect(!PinnedFingerprint.constantTimeEquals(Data([1, 2, 3]), Data([1, 2])))
}
