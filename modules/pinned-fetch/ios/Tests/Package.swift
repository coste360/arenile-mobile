// swift-tools-version:6.0
// Host-side unit tests of the fingerprint primitives (no Xcode or simulator
// needed): `swift test --package-path modules/pinned-fetch/ios/Tests`.
// The source is a symlink to ../PinnedFingerprint.swift, the file the pod builds.
import PackageDescription

let package = Package(
  name: "PinnedFingerprint",
  platforms: [.macOS(.v14)],
  targets: [
    .target(name: "PinnedFingerprint", swiftSettings: [.swiftLanguageMode(.v5)]),
    .testTarget(
      name: "PinnedFingerprintTests",
      dependencies: ["PinnedFingerprint"],
      swiftSettings: [.swiftLanguageMode(.v5)]
    ),
  ]
)
